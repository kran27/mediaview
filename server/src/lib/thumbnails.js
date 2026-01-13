import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import {
  EXCLUDE_PATTERNS,
  ROOT_DIR,
  THUMB_DIR,
  THUMB_EXT,
  THUMB_SIZES
} from '../config.js';
import { getHashEntry, onHashScanComplete } from './hash-cache.js';

const WORKER_POOL_LIMIT = 4;
const thumbnailWorkers = [];
let unsubscribeScanComplete = null;

const ensureThumbDir = async () => {
  try {
    await fsPromises.mkdir(THUMB_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to ensure thumbnail directory', error);
  }
};

export const getThumbName = (hash, variant, originalName) =>
  `${hash}-${variant}-${originalName}${THUMB_EXT}`;

export const getThumbPath = (hash, variant, originalName) =>
  path.join(THUMB_DIR, getThumbName(hash, variant, originalName));

export const enqueueThumbnailJobs = (paths) => {
  if (thumbnailWorkers.length === 0 || paths.length === 0) return;
  const uniquePaths = new Set(paths);
  const entries = [];
  uniquePaths.forEach((relativePath) => {
    const cached = getHashEntry(relativePath);
    if (!cached?.hash) return;
    entries.push({
      path: relativePath,
      hash: cached.hash,
      mtimeMs: cached.mtimeMs,
      size: cached.size ?? null
    });
  });
  if (entries.length === 0) return;
  const buckets = new Map();
  entries.forEach((entry) => {
    const index = getWorkerIndex(entry.path);
    if (!buckets.has(index)) buckets.set(index, []);
    buckets.get(index).push(entry);
  });
  buckets.forEach((bucketEntries, index) => {
    const worker = thumbnailWorkers[index];
    if (!worker) return;
    worker.postMessage({ type: 'enqueue', entries: bucketEntries });
  });
};

const getWorkerCount = () => {
  const cpuCount = os.cpus()?.length || 1;
  return Math.max(1, Math.min(WORKER_POOL_LIMIT, cpuCount));
};

const getWorkerIndex = (pathValue) => {
  if (!thumbnailWorkers.length) return 0;
  let hash = 0;
  for (let index = 0; index < pathValue.length; index += 1) {
    hash = ((hash << 5) - hash) + pathValue.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % thumbnailWorkers.length;
};

const dispatchSync = (updates, removals) => {
  if (thumbnailWorkers.length === 0) return;
  const buckets = new Map();
  updates.forEach((entry) => {
    if (!entry?.path) return;
    const index = getWorkerIndex(entry.path);
    if (!buckets.has(index)) buckets.set(index, { updates: [], removals: [] });
    buckets.get(index).updates.push(entry);
  });
  removals.forEach((entry) => {
    const pathValue = entry?.path;
    if (!pathValue) return;
    const index = getWorkerIndex(pathValue);
    if (!buckets.has(index)) buckets.set(index, { updates: [], removals: [] });
    buckets.get(index).removals.push(entry);
  });
  buckets.forEach((payload, index) => {
    if (payload.updates.length === 0 && payload.removals.length === 0) return;
    const worker = thumbnailWorkers[index];
    if (!worker) return;
    worker.postMessage({
      type: 'sync',
      entries: payload.updates,
      removals: payload.removals
    });
  });
};

export const startThumbnailWorker = async () => {
  await ensureThumbDir();
  try {
    const workerCount = getWorkerCount();
    for (let index = 0; index < workerCount; index += 1) {
      const worker = new Worker(new URL('../worker/thumbnail-worker.js', import.meta.url), {
        workerData: {
          rootDir: ROOT_DIR,
          thumbDir: THUMB_DIR,
          excludePatterns: EXCLUDE_PATTERNS,
          sizes: THUMB_SIZES,
          thumbExt: THUMB_EXT
        }
      });
      worker.on('error', (error) => {
        console.error(`Thumbnail worker ${index + 1} error`, error);
      });
      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`Thumbnail worker ${index + 1} exited with code ${code}`);
        }
      });
      thumbnailWorkers.push(worker);
    }
    unsubscribeScanComplete?.();
    unsubscribeScanComplete = onHashScanComplete(({ updates, removals }) => {
      if (updates.length === 0 && removals.length === 0) return;
      dispatchSync(updates, removals);
    });
  } catch (error) {
    console.error('Failed to start thumbnail worker', error);
  }
};
