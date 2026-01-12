import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Worker } from 'node:worker_threads';
import {
  CACHE_ROOT,
  EXCLUDE_PATTERNS,
  HASH_CACHE_SCAN_INTERVAL_MS,
  ROOT_DIR,
  ROOT_NAME
} from '../config.js';
import { classifyFile } from './classify.js';

export const HASH_CACHE_DIR = CACHE_ROOT;
export const HASH_CACHE_FILE = path.join(HASH_CACHE_DIR, 'file-hashes.json');

const HASH_CACHE = new Map();
const ENTRY_INDEX = new Map();
const DIR_CHILDREN = new Map();
const hashListeners = new Set();
const scanListeners = new Set();
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

const getParentPath = (relativePath) => {
  if (!relativePath) return null;
  const trimmed = relativePath.replace(/\/+$/, '');
  if (!trimmed) return null;
  const segments = trimmed.split('/');
  if (segments.length <= 1) return '';
  return segments.slice(0, -1).join('/');
};

const ensureDirEntry = (relativePath) => {
  const key = relativePath || '';
  const existing = ENTRY_INDEX.get(key);
  if (!existing || !existing.isDir) {
    ENTRY_INDEX.set(key, {
      name: key ? path.basename(key) : ROOT_NAME,
      path: key,
      isDir: true,
      size: null,
      ext: '',
      type: 'dir'
    });
  }
  if (!DIR_CHILDREN.has(key)) {
    DIR_CHILDREN.set(key, new Set());
  }
  const parentPath = getParentPath(key);
  if (parentPath !== null && key !== '') {
    ensureDirEntry(parentPath);
    DIR_CHILDREN.get(parentPath).add(key);
  }
};

const upsertFileEntry = (relativePath, entry) => {
  if (!relativePath) return;
  const ext = path.extname(relativePath).toLowerCase();
  ENTRY_INDEX.set(relativePath, {
    name: path.basename(relativePath),
    path: relativePath,
    isDir: false,
    size: entry.size ?? null,
    ext,
    type: classifyFile(ext)
  });
  const parentPath = getParentPath(relativePath);
  if (parentPath !== null) {
    ensureDirEntry(parentPath);
    DIR_CHILDREN.get(parentPath).add(relativePath);
  }
};

const removeEntryIndex = (relativePath) => {
  if (relativePath === '') return false;
  const existing = ENTRY_INDEX.get(relativePath);
  if (!existing) return false;
  if (existing.isDir) {
    const children = DIR_CHILDREN.get(relativePath);
    if (children) {
      [...children].forEach((childPath) => removeEntryIndex(childPath));
    }
    DIR_CHILDREN.delete(relativePath);
  }
  ENTRY_INDEX.delete(relativePath);
  const parentPath = getParentPath(relativePath);
  if (parentPath !== null) {
    DIR_CHILDREN.get(parentPath)?.delete(relativePath);
  }
  return true;
};

ensureDirEntry('');

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

export const onHashScanComplete = (listener) => {
  scanListeners.add(listener);
  return () => scanListeners.delete(listener);
};

export const setHashEntry = (relativePath, entry, options = {}) => {
  if (!relativePath || !entry?.hash) return;
  HASH_CACHE.set(relativePath, {
    hash: entry.hash,
    mtimeMs: entry.mtimeMs,
    size: entry.size ?? null
  });
  upsertFileEntry(relativePath, entry);
  if (options.emit !== false) {
    emitHashUpdate({
      path: relativePath,
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null
    });
  }
  if (options.persist !== false) {
    scheduleFlush();
  }
};

export const removeHashEntry = (relativePath) => {
  if (!HASH_CACHE.delete(relativePath)) return;
  const existing = ENTRY_INDEX.get(relativePath);
  if (existing && !existing.isDir) {
    removeEntryIndex(relativePath);
  }
  scheduleFlush();
};

export const loadHashCache = async () => {
  ensureDirEntry('');
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
      upsertFileEntry(relativePath, entry);
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

export const hasHashEntry = (relativePath) => HASH_CACHE.has(relativePath);

export const hasDirectoryEntry = (relativePath) =>
  ENTRY_INDEX.get(relativePath || '')?.isDir === true;

export const getDirectoryEntries = (relativePath) => {
  const key = relativePath || '';
  const children = DIR_CHILDREN.get(key);
  if (!children) return null;
  const entries = [];
  children.forEach((childPath) => {
    const entry = ENTRY_INDEX.get(childPath);
    if (entry) entries.push(entry);
  });
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return entries;
};

export const getDirectoryTree = () => {
  const nodes = {};
  const pending = [''];
  while (pending.length > 0) {
    const current = pending.pop();
    const entry = ENTRY_INDEX.get(current) || {
      name: current ? path.basename(current) : ROOT_NAME,
      path: current
    };
    const children = DIR_CHILDREN.get(current);
    const dirChildren = children
      ? [...children].filter((childPath) => ENTRY_INDEX.get(childPath)?.isDir)
      : [];
    dirChildren.sort((a, b) =>
      path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: 'base' })
    );
    nodes[current] = {
      name: entry.name,
      path: current,
      children: dirChildren
    };
    dirChildren.forEach((childPath) => pending.push(childPath));
  }
  return nodes;
};

export const setDirectoryEntry = (relativePath) => {
  if (relativePath === null || relativePath === undefined) return;
  ensureDirEntry(relativePath);
};

export const removeDirectoryEntry = (relativePath) => {
  if (!relativePath) return;
  if (ENTRY_INDEX.get(relativePath)?.isDir) {
    removeEntryIndex(relativePath);
  }
};

export const startHashCacheWorker = async () => {
  if (cacheWorker) return;
  await ensureCacheDir();
  try {
    cacheWorker = new Worker(new URL('../worker/hash-cache-worker.js', import.meta.url), {
      workerData: {
        rootDir: ROOT_DIR,
        cacheFile: HASH_CACHE_FILE,
        excludePatterns: EXCLUDE_PATTERNS,
        scanIntervalMs: HASH_CACHE_SCAN_INTERVAL_MS
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
      if (message.type === 'dir-update' && Array.isArray(message.entries)) {
        message.entries.forEach((entry) => {
          if (!entry?.path) return;
          setDirectoryEntry(entry.path);
        });
      }
      if (message.type === 'hash-remove' && Array.isArray(message.paths)) {
        message.paths.forEach((pathValue) => removeHashEntry(pathValue));
      }
      if (message.type === 'dir-remove' && Array.isArray(message.paths)) {
        message.paths.forEach((pathValue) => removeDirectoryEntry(pathValue));
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
        scanListeners.forEach((listener) => listener(cacheStatus));
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
