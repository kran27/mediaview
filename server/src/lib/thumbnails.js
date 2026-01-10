import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import {
  EXCLUDE_PATTERNS,
  ROOT_DIR,
  THUMB_DIR,
  THUMB_EXT,
  THUMB_SIZES
} from '../config.js';
import {
  HASH_CACHE_FILE,
  getCachedHash,
  onHashUpdate,
  setHashEntry
} from './hash-cache.js';

let thumbnailWorker = null;
let unsubscribeHashUpdates = null;

const ensureThumbDir = async () => {
  try {
    await fsPromises.mkdir(THUMB_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to ensure thumbnail directory', error);
  }
};

export const getThumbName = (hash, variant, originalName) =>
  `${hash}-${variant}-${originalName}${THUMB_EXT}`;

export { getCachedHash };

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
        thumbExt: THUMB_EXT,
        cacheFile: HASH_CACHE_FILE
      }
    });
    thumbnailWorker.on('message', (message) => {
      if (message?.type === 'hashed') {
        setHashEntry(message.path, {
          hash: message.hash,
          mtimeMs: message.mtimeMs,
          size: message.size
        }, { emit: false });
      }
    });
    unsubscribeHashUpdates?.();
    unsubscribeHashUpdates = onHashUpdate((entry) => {
      if (!thumbnailWorker || !entry?.path) return;
      thumbnailWorker.postMessage({ type: 'hash-update', entry });
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
