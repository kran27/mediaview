import path from 'node:path';
import { ROOT_NAME } from '../config.js';
import { getDirectoryEntries, hasDirectoryEntry } from '../lib/hash-cache.js';
import { isExcludedPath } from '../lib/exclude.js';
import { decodePathSegments, sanitizeRequestPath } from '../lib/paths.js';
import { buildStats } from '../lib/stats.js';
import { enqueueThumbnailJobs } from '../lib/thumbnails.js';

const collectThumbPaths = (entries) =>
  entries
    .filter((entry) => entry.type === 'image' || entry.type === 'video')
    .map((entry) => entry.path);

export const registerListRoute = (app) => {
  const getRequestPath = (req) => {
    if (typeof req.params.path === 'string' || Array.isArray(req.params.path)) {
      return decodePathSegments(req.params.path);
    }
    if (typeof req.params[0] === 'string') {
      return decodePathSegments(req.params[0]);
    }
    if (typeof req.query.path === 'string') {
      return req.query.path;
    }
    return '';
  };

  const handleRequest = (req, res) => {
    let requestPath;
    try {
      requestPath = sanitizeRequestPath(getRequestPath(req));
      if (isExcludedPath(requestPath)) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
      return;
    }

    if (!hasDirectoryEntry(requestPath)) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const entries = getDirectoryEntries(requestPath) || [];
    const stats = buildStats(entries);

    const children = {};
    entries
      .filter((entry) => entry.isDir)
      .forEach((entry) => {
        children[entry.path] = getDirectoryEntries(entry.path) || [];
      });

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
        name: requestPath ? path.posix.basename(requestPath) : ROOT_NAME,
        path: requestPath
      },
      stats,
      entries,
      children
    });
  };

  app.get('/api/list', handleRequest);
  app.get('/api/list/*path', handleRequest);
};
