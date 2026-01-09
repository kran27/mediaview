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
  app.get('/api/list', async (req, res) => {
    const requestPath = normalizeRequestPath(req.query.path || '');
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
          path: requestPath,
          mtime: dirStats.mtime.toISOString(),
          mtimeMs: dirStats.mtimeMs
        },
        stats,
        entries,
        children
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to read directory', detail: error.message });
    }
  });
};
