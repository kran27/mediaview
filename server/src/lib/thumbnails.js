import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { EXCLUDED_PATTERNS, ROOT_DIR, THUMB_DIR, THUMB_EXT, THUMB_SIZES } from '../config.js';
import { isThumbablePath } from './classify.js';
import {
  THUMB_ERR_LIMIT,
  getHashEntries,
  getHashEntry,
  getThumbErrCount,
  incrementThumbErrCount,
  resetThumbErrCount,
  onHashScanComplete,
} from './hash-cache.js';

const WORKER_POOL_LIMIT = 4;
const thumbnailWorkers = [];
let unsubscribeScanComplete = null;
let initialScanVerified = false;
const onDemandJobs = new Map();

const ensureThumbDir = async () => {
  try {
    await fsPromises.mkdir(THUMB_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to ensure thumbnail directory', error);
  }
};

export const getThumbName = (hash, variant, originalName, ext = THUMB_EXT) => {
  const normalized = ext.startsWith('.') ? ext : `.${ext}`;
  return `${hash}-${variant}-${originalName}${normalized}`;
};

export const getThumbPath = (hash, variant, originalName, ext = THUMB_EXT) =>
  path.join(THUMB_DIR, getThumbName(hash, variant, originalName, ext));

export const enqueueThumbnailJobs = (paths) => {
  if (thumbnailWorkers.length === 0 || paths.length === 0) return;
  const uniquePaths = new Set(paths);
  const entries = [];
  uniquePaths.forEach((relativePath) => {
    const cached = getHashEntry(relativePath);
    if (!cached?.hash) return;
    if (getThumbErrCount(relativePath) > THUMB_ERR_LIMIT) return;
    entries.push({
      path: relativePath,
      hash: cached.hash,
      mtimeMs: cached.mtimeMs,
      size: cached.size ?? null,
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

export const generateThumbnailOnDemand = async (relativePath, size) => {
  if (thumbnailWorkers.length === 0) {
    throw new Error('Thumbnail workers not available');
  }

  const cached = getHashEntry(relativePath);
  if (!cached?.hash) {
    throw new Error('File hash not found');
  }

  if (getThumbErrCount(relativePath) > THUMB_ERR_LIMIT) {
    throw new Error('Thumbnail generation failed too many times');
  }

  if (!isThumbablePath(relativePath)) {
    throw new Error('Path is not thumbable');
  }

  const jobKey = `${relativePath}:${size}`;
  if (onDemandJobs.has(jobKey)) {
    return onDemandJobs.get(jobKey);
  }

  const jobPromise = new Promise((resolve, reject) => {
    const workerIndex = getWorkerIndex(relativePath);
    const worker = thumbnailWorkers[workerIndex];

    if (!worker) {
      reject(new Error('No worker available for job'));
      return;
    }

    const job = {
      resolve: () => {
        onDemandJobs.delete(jobKey);
        resolve();
      },
      reject: (error) => {
        onDemandJobs.delete(jobKey);
        reject(error);
      },
      timeout: setTimeout(() => {
        onDemandJobs.delete(jobKey);
        reject(new Error('Thumbnail generation timed out'));
      }, 30000),
    };

    onDemandJobs.set(jobKey, jobPromise);

    worker.postMessage({
      type: 'enqueue',
      entries: [
        {
          path: relativePath,
          hash: cached.hash,
          mtimeMs: cached.mtimeMs,
          size: cached.size ?? null,
        },
      ],
    });

    // We rely on the worker message handler to resolve/reject via path matching
    // since worker.on('message') is already listening globally in startThumbnailWorker.
  });

  return jobPromise;
};

// Proactive verification disabled for on-demand mode

const getWorkerCount = () => {
  const cpuCount = os.cpus()?.length || 1;
  return Math.max(1, Math.min(WORKER_POOL_LIMIT, cpuCount));
};

const getWorkerIndex = (pathValue) => {
  if (!thumbnailWorkers.length) return 0;
  let hash = 0;
  for (let index = 0; index < pathValue.length; index += 1) {
    hash = (hash << 5) - hash + pathValue.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash) % thumbnailWorkers.length;
};

const dispatchSync = (_updates, removals) => {
  if (thumbnailWorkers.length === 0) return;
  const buckets = new Map();
  // We only sync removals in on-demand mode to keep storage clean
  removals.forEach((entry) => {
    const pathValue = entry?.path;
    if (!pathValue) return;
    const index = getWorkerIndex(pathValue);
    if (!buckets.has(index)) buckets.set(index, { updates: [], removals: [] });
    buckets.get(index).removals.push(entry);
  });
  buckets.forEach((payload, index) => {
    if (payload.removals.length === 0) return;
    const worker = thumbnailWorkers[index];
    if (!worker) return;
    worker.postMessage({
      type: 'sync',
      entries: [],
      removals: payload.removals,
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
          excludedPatterns: EXCLUDED_PATTERNS,
          sizes: THUMB_SIZES,
          thumbExt: THUMB_EXT,
        },
      });
      worker.on('error', (error) => {
        console.error(`Thumbnail worker ${index + 1} error`, error);
      });
      worker.on('message', (message) => {
        if (message?.path) {
          const sizeKeys = Object.keys(THUMB_SIZES);
          sizeKeys.forEach((size) => {
            const jobKey = `${message.path}:${size}`;
            const job = onDemandJobs.get(jobKey);
            if (job) {
              clearTimeout(job.timeout);
              onDemandJobs.delete(jobKey);
              if (message.type === 'thumb-success') {
                job.resolve();
              } else if (message.type === 'thumb-error') {
                job.reject(new Error('Thumbnail generation failed'));
              }
            }
          });
        }
        if (message?.type === 'thumb-error' && message.path) {
          incrementThumbErrCount(message.path);
        }
        if (message?.type === 'thumb-success' && message.path) {
          resetThumbErrCount(message.path);
        }
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
      // Background updates are ignored in on-demand mode.
      // We only process removals to delete stale thumbnails.
      if (removals.length > 0) {
        dispatchSync([], removals);
      }
    });
  } catch (error) {
    console.error('Failed to start thumbnail worker', error);
  }
};
