import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { THUMB_SIZES } from '../config.js';
import { isThumbablePath } from '../lib/classify.js';
import { isExcludedPath } from '../lib/exclude.js';
import { normalizeRequestPath, resolveSafePath } from '../lib/paths.js';
import { enqueueThumbnailJobs, getCachedHash, getThumbPath } from '../lib/thumbnails.js';

const buildEtag = (hash, size, name) => `"thumb-${hash}-${size}-${name}"`;

const matchesEtag = (headerValue, etag) => {
  if (!headerValue) return false;
  const candidates = headerValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('W/') ? value.slice(2) : value));
  return candidates.includes('*') || candidates.includes(etag);
};

export const registerThumbnailRoute = (app) => {
  app.get('/api/thumbnail', async (req, res) => {
    const requestPath = normalizeRequestPath(req.query.path || '');
    const size = String(req.query.size || 'sm').toLowerCase();
    if (!THUMB_SIZES[size]) {
      res.status(400).json({ error: 'Invalid thumbnail size' });
      return;
    }
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
      if (!isThumbablePath(requestPath)) {
        res.status(415).json({ error: 'Unsupported media type' });
        return;
      }
      const hash = await getCachedHash(requestPath, absolutePath, stats);
      const thumbPath = getThumbPath(hash, size, path.basename(requestPath));
      if (!fs.existsSync(thumbPath)) {
        enqueueThumbnailJobs([requestPath]);
        res.status(404).json({ error: 'Thumbnail not ready' });
        return;
      }
      const mimeType = mime.lookup(thumbPath) || 'application/octet-stream';
      const etag = buildEtag(hash, size, path.basename(requestPath));
      const cacheControl = 'public, max-age=604800, immutable';
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', cacheControl);
      if (matchesEtag(req.headers['if-none-match'], etag)) {
        res.status(304).end();
        return;
      }
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Cache-Control': cacheControl
      });
      fs.createReadStream(thumbPath).pipe(res);
    } catch (error) {
      res.status(500).json({ error: 'Failed to load thumbnail', detail: error.message });
    }
  });
};
