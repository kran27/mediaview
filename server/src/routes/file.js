import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import mime from 'mime-types';
import { isExcludedPath } from '../lib/exclude.js';
import { normalizeRequestPath, resolveSafePath } from '../lib/paths.js';

export const registerFileRoute = (app) => {
  app.get('/api/file', async (req, res) => {
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
      const stats = await fsPromises.stat(absolutePath);
      if (!stats.isFile()) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
      const range = req.headers.range;

      if (range) {
        const [startRaw, endRaw] = range.replace(/bytes=/, '').split('-');
        const start = startRaw ? Number(startRaw) : 0;
        const end = endRaw ? Number(endRaw) : stats.size - 1;
        const clampedStart = Math.min(Math.max(start, 0), stats.size - 1);
        const clampedEnd = Math.min(Math.max(end, clampedStart), stats.size - 1);

        if (
          Number.isNaN(start) ||
          Number.isNaN(end) ||
          start < 0 ||
          end < 0 ||
          start >= stats.size ||
          end >= stats.size ||
          clampedStart > clampedEnd
        ) {
          res.status(416).setHeader('Content-Range', `bytes */${stats.size}`).end();
          return;
        }

        const chunkSize = clampedEnd - clampedStart + 1;
        res.writeHead(206, {
          'Content-Range': `bytes ${clampedStart}-${clampedEnd}/${stats.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600'
        });
        fs.createReadStream(absolutePath, { start: clampedStart, end: clampedEnd }).pipe(res);
        return;
      }

      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600'
      });
      fs.createReadStream(absolutePath).pipe(res);
    } catch (error) {
      res.status(500).json({ error: 'Failed to stream file', detail: error.message });
    }
  });
};
