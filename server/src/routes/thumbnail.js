import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import mime from 'mime-types';
import { THUMB_SIZES } from '../config.js';
import { isThumbablePath } from '../lib/classify.js';
import { isExcludedPath } from '../lib/exclude.js';
import { matchesEtag } from '../lib/http.js';
import { decodePathSegments, resolveSafePath, sanitizeRequestPath } from '../lib/paths.js';
import { getHashEntry, hasHashEntry } from '../lib/hash-cache.js';
import { enqueueThumbnailJobs, getThumbPath } from '../lib/thumbnails.js';

const parseThumbnailRequest = (req) => {
  if (typeof req.params.size === 'string' && (typeof req.params.path === 'string' || Array.isArray(req.params.path))) {
    return {
      requestPath: decodePathSegments(req.params.path),
      size: req.params.size
    };
  }
  if (typeof req.params.path === 'string' || Array.isArray(req.params.path)) {
    const decoded = decodePathSegments(req.params.path);
    const segments = decoded.split('/').filter(Boolean);
    const leading = segments[0] ? segments[0].toLowerCase() : '';
    if (leading && THUMB_SIZES[leading]) {
      return { requestPath: segments.slice(1).join('/'), size: leading };
    }
    const trailing = segments[segments.length - 1] ? segments[segments.length - 1].toLowerCase() : '';
    if (trailing && THUMB_SIZES[trailing]) {
      return { requestPath: segments.slice(0, -1).join('/'), size: trailing };
    }
    return { requestPath: decoded, size: String(req.query.size || 'sm') };
  }
  if (typeof req.query.path === 'string') {
    return { requestPath: req.query.path, size: String(req.query.size || 'sm') };
  }
  return { requestPath: '', size: String(req.query.size || 'sm') };
};

export const registerThumbnailRoute = (app) => {
  const handleRequest = async (req, res) => {
    let parsed;
    let requestPath;
    let size;
    try {
      parsed = parseThumbnailRequest(req);
      requestPath = sanitizeRequestPath(parsed.requestPath || '');
      size = String(parsed.size || 'sm').toLowerCase();
    } catch (error) {
      res.status(error.statusCode || 400).json({ error: error.message });
      return;
    }
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
      if (!hasHashEntry(requestPath)) {
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
      const cached = getHashEntry(requestPath);
      if (!cached?.hash) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const hash = cached.hash;
      const thumbPath = getThumbPath(hash, size, path.basename(requestPath));
      if (!fs.existsSync(thumbPath)) {
        enqueueThumbnailJobs([requestPath]);
        res.status(404).json({ error: 'Thumbnail not ready' });
        return;
      }
      const mimeType = mime.lookup(thumbPath) || 'application/octet-stream';
      const etag = `"${hash}"`;
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
  };

  app.get('/api/thumbnail', handleRequest);
  app.get('/api/thumbnail/:size/*path', handleRequest);
  app.get('/api/thumbnail/*path', handleRequest);
};
