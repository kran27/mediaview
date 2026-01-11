import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import mime from 'mime-types';
import { isExcludedPath } from '../lib/exclude.js';
import { getCachedHash } from '../lib/hash-cache.js';
import { normalizeRequestPath, resolveSafePath } from '../lib/paths.js';

const buildEtag = (hash) => `"sha256-${hash}"`;
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

const matchesEtag = (headerValue, etag) => {
  if (!headerValue) return false;
  const candidates = headerValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('W/') ? value.slice(2) : value));
  return candidates.includes('*') || candidates.includes(etag);
};

export const registerFileRoute = (app) => {
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
      const stats = await fsPromises.stat(absolutePath);
      if (!stats.isFile()) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const mimeType = mime.lookup(absolutePath) || 'application/octet-stream';
      const hash = await getCachedHash(requestPath, absolutePath, stats);
      const etag = buildEtag(hash);
      const cacheControl = 'public, max-age=3600, must-revalidate';
      res.setHeader('ETag', etag);
      res.setHeader('Last-Modified', stats.mtime.toUTCString());
      res.setHeader('Cache-Control', cacheControl);
      if (matchesEtag(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }
      const range = req.headers.range;

      if (stats.size === 0) {
        res.writeHead(200, {
          'Content-Length': 0,
          'Content-Type': mimeType,
          'Accept-Ranges': 'bytes',
          'Cache-Control': cacheControl
        });
        res.end();
        return;
      }

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
          'Cache-Control': cacheControl
        });
        fs.createReadStream(absolutePath, { start: clampedStart, end: clampedEnd }).pipe(res);
        return;
      }

      res.writeHead(200, {
        'Content-Length': stats.size,
        'Content-Type': mimeType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': cacheControl
      });
      fs.createReadStream(absolutePath).pipe(res);
    } catch (error) {
      res.status(500).json({ error: 'Failed to stream file', detail: error.message });
    }
  };

  app.get('/api/file', handleRequest);
  app.get('/api/file/*', handleRequest);
};
