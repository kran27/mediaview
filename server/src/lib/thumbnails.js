import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import {
  EXCLUDE_PATTERNS,
  ROOT_DIR,
  THUMB_DIR,
  THUMB_EXT,
  THUMB_SIZES
} from '../config.js';

const HASH_CACHE = new Map();
let thumbnailWorker = null;

const ensureThumbDir = async () => {
  try {
    await fsPromises.mkdir(THUMB_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to ensure thumbnail directory', error);
  }
};

const hashFile = (absolutePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

export const getCachedHash = async (relativePath, absolutePath, stats) => {
  const cached = HASH_CACHE.get(relativePath);
  if (cached && cached.mtimeMs === stats.mtimeMs && cached.size === stats.size) {
    return cached.hash;
  }
  const hash = await hashFile(absolutePath);
  HASH_CACHE.set(relativePath, { hash, mtimeMs: stats.mtimeMs, size: stats.size });
  return hash;
};

export const getThumbName = (hash, variant, originalName) =>
  `${hash}-${variant}-${originalName}${THUMB_EXT}`;

export const getThumbPath = (hash, variant, originalName) =>
  path.join(THUMB_DIR, getThumbName(hash, variant, originalName));

export const enqueueThumbnailJobs = (paths) => {
  if (!thumbnailWorker || paths.length === 0) return;
  thumbnailWorker.postMessage({ type: 'enqueue', paths });
};

export const startThumbnailWorker = async () => {
  await ensureThumbDir();
  try {
    thumbnailWorker = new Worker(new URL('../worker/thumbnail-worker.js', import.meta.url), {
      workerData: {
        rootDir: ROOT_DIR,
        thumbDir: THUMB_DIR,
        excludePatterns: EXCLUDE_PATTERNS,
        sizes: THUMB_SIZES,
        thumbExt: THUMB_EXT
      }
    });
    thumbnailWorker.on('message', (message) => {
      if (message?.type === 'hashed') {
        HASH_CACHE.set(message.path, {
          hash: message.hash,
          mtimeMs: message.mtimeMs,
          size: message.size
        });
      }
    });
    thumbnailWorker.on('error', (error) => {
      console.error('Thumbnail worker error', error);
    });
    thumbnailWorker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Thumbnail worker exited with code ${code}`);
      }
    });
    thumbnailWorker.postMessage({ type: 'scan' });
  } catch (error) {
    console.error('Failed to start thumbnail worker', error);
  }
};
