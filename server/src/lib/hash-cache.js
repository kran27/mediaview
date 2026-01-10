import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { EXCLUDE_PATTERNS, ROOT_DIR } from '../config.js';

export const HASH_CACHE_DIR = path.join(ROOT_DIR, '.cache');
export const HASH_CACHE_FILE = path.join(HASH_CACHE_DIR, 'file-hashes.json');

const HASH_CACHE = new Map();
const hashListeners = new Set();
let cacheWorker = null;
let flushTimer = null;
let flushing = false;
let unsubscribeWorkerUpdates = null;
const cacheStatus = {
  lastScanStart: null,
  lastScanEnd: null,
  lastScanDurationMs: null,
  lastScanUpdates: 0,
  lastScanRemovals: 0
};

const ensureCacheDir = async () => {
  await fsPromises.mkdir(HASH_CACHE_DIR, { recursive: true });
};

const hashFile = (absolutePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const serializeCache = () => {
  const entries = {};
  for (const [relativePath, entry] of HASH_CACHE.entries()) {
    entries[relativePath] = entry;
  }
  return { version: 1, entries };
};

const writeCacheFile = async () => {
  if (flushing) return;
  flushing = true;
  try {
    await ensureCacheDir();
    const payload = JSON.stringify(serializeCache());
    const tmpPath = `${HASH_CACHE_FILE}.tmp`;
    await fsPromises.writeFile(tmpPath, payload, 'utf8');
    await fsPromises.rename(tmpPath, HASH_CACHE_FILE);
  } catch (error) {
    console.error('Failed to write hash cache', error);
  } finally {
    flushing = false;
  }
};

const scheduleFlush = () => {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void writeCacheFile();
  }, 500);
};

const emitHashUpdate = (entry) => {
  hashListeners.forEach((listener) => listener(entry));
};

export const onHashUpdate = (listener) => {
  hashListeners.add(listener);
  return () => hashListeners.delete(listener);
};

export const setHashEntry = (relativePath, entry, options = {}) => {
  if (!relativePath || !entry?.hash) return;
  HASH_CACHE.set(relativePath, {
    hash: entry.hash,
    mtimeMs: entry.mtimeMs,
    size: entry.size ?? null
  });
  if (options.emit !== false) {
    emitHashUpdate({
      path: relativePath,
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null
    });
  }
  scheduleFlush();
};

export const removeHashEntry = (relativePath) => {
  if (!HASH_CACHE.delete(relativePath)) return;
  scheduleFlush();
};

export const loadHashCache = async () => {
  await ensureCacheDir();
  try {
    const contents = await fsPromises.readFile(HASH_CACHE_FILE, 'utf8');
    const data = JSON.parse(contents);
    const entries = data?.entries || {};
    Object.entries(entries).forEach(([relativePath, entry]) => {
      if (!entry?.hash || !Number.isFinite(entry.mtimeMs)) return;
      HASH_CACHE.set(relativePath, {
        hash: entry.hash,
        mtimeMs: entry.mtimeMs,
        size: entry.size ?? null
      });
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to read hash cache', error);
    }
  }
};

export const getCachedHash = async (relativePath, absolutePath, stats) => {
  const cached = HASH_CACHE.get(relativePath);
  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cached.hash;
  }
  const hash = await hashFile(absolutePath);
  setHashEntry(relativePath, { hash, mtimeMs: stats.mtimeMs, size: stats.size });
  return hash;
};

export const startHashCacheWorker = async () => {
  if (cacheWorker) return;
  await ensureCacheDir();
  try {
    cacheWorker = new Worker(new URL('../worker/hash-cache-worker.js', import.meta.url), {
      workerData: {
        rootDir: ROOT_DIR,
        cacheFile: HASH_CACHE_FILE,
        excludePatterns: EXCLUDE_PATTERNS
      }
    });
    cacheWorker.on('message', (message) => {
      if (!message) return;
      if (message.type === 'hash-update' && Array.isArray(message.entries)) {
        message.entries.forEach((entry) => {
          if (!entry?.path) return;
          setHashEntry(entry.path, entry);
        });
      }
      if (message.type === 'hash-remove' && Array.isArray(message.paths)) {
        message.paths.forEach((pathValue) => removeHashEntry(pathValue));
      }
      if (message.type === 'scan-start') {
        cacheStatus.lastScanStart = message.startedAt;
        cacheStatus.lastScanEnd = null;
        cacheStatus.lastScanDurationMs = null;
        cacheStatus.lastScanUpdates = 0;
        cacheStatus.lastScanRemovals = 0;
      }
      if (message.type === 'scan-complete') {
        cacheStatus.lastScanStart = message.startedAt;
        cacheStatus.lastScanEnd = message.finishedAt;
        cacheStatus.lastScanDurationMs = message.finishedAt - message.startedAt;
        cacheStatus.lastScanUpdates = message.updatedCount || 0;
        cacheStatus.lastScanRemovals = message.removedCount || 0;
      }
    });
    unsubscribeWorkerUpdates?.();
    unsubscribeWorkerUpdates = onHashUpdate((entry) => {
      if (!cacheWorker || !entry?.path) return;
      cacheWorker.postMessage({ type: 'hash-update', entry });
    });
    cacheWorker.on('error', (error) => {
      console.error('Hash cache worker error', error);
    });
    cacheWorker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Hash cache worker exited with code ${code}`);
      }
    });
  } catch (error) {
    console.error('Failed to start hash cache worker', error);
  }
};

export const getHashCacheStatus = () => ({
  entries: HASH_CACHE.size,
  workerRunning: Boolean(cacheWorker),
  lastScan: {
    startedAt: cacheStatus.lastScanStart ? new Date(cacheStatus.lastScanStart).toISOString() : null,
    finishedAt: cacheStatus.lastScanEnd ? new Date(cacheStatus.lastScanEnd).toISOString() : null,
    durationMs: cacheStatus.lastScanDurationMs,
    updates: cacheStatus.lastScanUpdates,
    removals: cacheStatus.lastScanRemovals
  }
});
