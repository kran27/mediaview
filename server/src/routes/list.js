import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { ROOT_NAME } from '../config.js';
import { readDirectory, buildStats } from '../lib/directory.js';
import { isExcludedPath } from '../lib/exclude.js';
import { normalizeRequestPath, resolveSafePath } from '../lib/paths.js';
import { enqueueThumbnailJobs } from '../lib/thumbnails.js';

const collectThumbPaths = (entries) =>
  entries
    .filter((entry) => entry.type === 'image' || entry.type === 'video')
    .map((entry) => entry.path);

export const registerListRoute = (app) => {
  const decodePathSegments = (rawPath) =>
    rawPath
      .split('/')
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join('/');
  const getRequestPath = (req) => {
    if (typeof req.params[0] === 'string') {
      return decodePathSegments(req.params[0]);
    }
    if (typeof req.query.path === 'string') {
      return req.query.path;
    }
    return '';
  };

  const handleRequest = async (req, res) => {
    const requestPath = normalizeRequestPath(getRequestPath(req));
    let absolutePath;
    try {
      if (isExcludedPath(requestPath)) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      absolutePath = resolveSafePath(requestPath);
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
      return;
    }

    try {
      const dirStats = await fsPromises.stat(absolutePath);
      if (!dirStats.isDirectory()) {
        res.status(400).json({ error: 'Not a directory' });
        return;
      }

      const entries = await readDirectory(requestPath);
      const stats = buildStats(entries);

      const children = {};
      await Promise.all(
        entries
          .filter((entry) => entry.isDir)
          .map(async (entry) => {
            try {
              children[entry.path] = await readDirectory(entry.path);
            } catch (error) {
              children[entry.path] = [];
            }
          })
      );

      const thumbPaths = collectThumbPaths(entries);
      Object.values(children).forEach((childEntries) => {
        thumbPaths.push(...collectThumbPaths(childEntries));
      });
      enqueueThumbnailJobs(thumbPaths);

      res.json({
        root: {
          name: ROOT_NAME,
          path: ''
        },
        current: {
          name: requestPath ? path.basename(absolutePath) : ROOT_NAME,
          path: requestPath
        },
        stats,
        entries,
        children
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.status(500).json({ error: 'Failed to read directory', detail: error.message });
    }
  };

  app.get('/api/list', handleRequest);
  app.get('/api/list/*', handleRequest);
};
