import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { parentPort, workerData } from 'node:worker_threads';
import { minimatch } from 'minimatch';

const { rootDir, cacheFile, excludePatterns, scanIntervalMs } = workerData;
const BATCH_SIZE = 200;
const SCAN_INTERVAL_MS = Number(scanIntervalMs) > 0 ? Number(scanIntervalMs) : 60 * 1000;
let scanTimer = null;
let scanning = false;
const cache = new Map();

const toPosix = (value) => value.split(path.sep).join('/');

const isExcludedPath = (relativePath) => {
  if (!relativePath) return false;
  const posixPath = toPosix(relativePath);
  if (
    posixPath === '.thumbnail' ||
    posixPath.startsWith('.thumbnail/') ||
    posixPath === '.cache' ||
    posixPath.startsWith('.cache/')
  ) {
    return true;
  }
  if (!excludePatterns || excludePatterns.length === 0) return false;
  const candidates = new Set([posixPath, posixPath.replace(/\/+$/, ''), `${posixPath}/`]);
  return excludePatterns.some((pattern) =>
    [...candidates].some((candidate) =>
      minimatch(candidate, pattern, { dot: true, matchBase: true })
    )
  );
};

const hashFile = (absolutePath) =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const loadCache = async () => {
  try {
    const contents = await fsPromises.readFile(cacheFile, 'utf8');
    const data = JSON.parse(contents);
    const entries = data?.entries || {};
    Object.entries(entries).forEach(([relativePath, entry]) => {
      if (!entry?.hash || !Number.isFinite(entry.mtimeMs)) return;
      cache.set(relativePath, {
        kind: 'file',
        hash: entry.hash,
        mtimeMs: entry.mtimeMs,
        size: entry.size ?? null
      });
    });
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // ignore parse errors and missing file
    }
  }
};

const scanTree = async () => {
  const seenFiles = new Set();
  const seenDirs = new Set();
  const updates = [];
  const dirUpdates = [];
  let fileUpdateCount = 0;
  let dirUpdateCount = 0;

  const flushUpdates = () => {
    if (updates.length === 0) return;
    fileUpdateCount += updates.length;
    parentPort?.postMessage({ type: 'hash-update', entries: updates.splice(0, updates.length) });
  };

  const flushDirUpdates = () => {
    if (dirUpdates.length === 0) return;
    dirUpdateCount += dirUpdates.length;
    parentPort?.postMessage({ type: 'dir-update', entries: dirUpdates.splice(0, dirUpdates.length) });
  };

  const ensureDir = (relativePath) => {
    seenDirs.add(relativePath);
    const cached = cache.get(relativePath);
    if (!cached || cached.kind !== 'dir') {
      cache.set(relativePath, { kind: 'dir' });
      dirUpdates.push({ path: relativePath });
      if (dirUpdates.length >= BATCH_SIZE) {
        flushDirUpdates();
      }
    }
  };

  const stack = [''];
  ensureDir('');
  while (stack.length > 0) {
    const current = stack.pop();
    const absolutePath = path.join(rootDir, current);
    let dirEntries;
    try {
      dirEntries = await fsPromises.readdir(absolutePath, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const dirent of dirEntries) {
      const relativePath = toPosix(path.join(current, dirent.name));
      if (isExcludedPath(relativePath)) continue;
      if (dirent.isDirectory()) {
        ensureDir(relativePath);
        stack.push(relativePath);
        continue;
      }
      if (!dirent.isFile()) continue;
      seenFiles.add(relativePath);
      const filePath = path.join(rootDir, relativePath);
      let stats;
      try {
        stats = await fsPromises.stat(filePath);
      } catch {
        continue;
      }
      const cached = cache.get(relativePath);
      if (cached && cached.kind === 'file' && cached.mtimeMs === stats.mtimeMs) {
        continue;
      }
      try {
        const hash = await hashFile(filePath);
        cache.set(relativePath, { kind: 'file', hash, mtimeMs: stats.mtimeMs, size: stats.size });
        updates.push({ path: relativePath, hash, mtimeMs: stats.mtimeMs, size: stats.size });
        if (updates.length >= BATCH_SIZE) {
          flushUpdates();
        }
      } catch {
        // ignore hash failures
      }
    }
  }

  flushUpdates();
  flushDirUpdates();

  const fileRemovals = [];
  const dirRemovals = [];
  for (const [cachedPath, cachedEntry] of cache.entries()) {
    if (cachedEntry?.kind === 'dir') {
      if (!seenDirs.has(cachedPath)) {
        dirRemovals.push(cachedPath);
      }
    } else if (!seenFiles.has(cachedPath)) {
      fileRemovals.push(cachedPath);
    }
  }
  if (fileRemovals.length > 0) {
    parentPort?.postMessage({ type: 'hash-remove', paths: fileRemovals });
    fileRemovals.forEach((relativePath) => cache.delete(relativePath));
  }
  if (dirRemovals.length > 0) {
    parentPort?.postMessage({ type: 'dir-remove', paths: dirRemovals });
    dirRemovals.forEach((relativePath) => cache.delete(relativePath));
  }
  return {
    updatedCount: fileUpdateCount + dirUpdateCount,
    removedCount: fileRemovals.length + dirRemovals.length
  };
};

const scheduleScan = () => {
  if (scanTimer) return;
  scanTimer = setTimeout(() => {
    scanTimer = null;
    void runScan();
  }, SCAN_INTERVAL_MS);
};

const runScan = async () => {
  if (scanning) return;
  scanning = true;
  const startedAt = Date.now();
  parentPort?.postMessage({ type: 'scan-start', startedAt });
  let result = { updatedCount: 0, removedCount: 0 };
  try {
    result = await scanTree();
  } catch {
    // ignore scan failures
  }
  const finishedAt = Date.now();
  parentPort?.postMessage({
    type: 'scan-complete',
    startedAt,
    finishedAt,
    updatedCount: result.updatedCount,
    removedCount: result.removedCount
  });
  scanning = false;
  scheduleScan();
};

await loadCache();
void runScan();

parentPort?.on('message', (message) => {
  if (!message) return;
  if (message.type === 'hash-update' && message.entry?.path) {
    cache.set(message.entry.path, {
      kind: 'file',
      hash: message.entry.hash,
      mtimeMs: message.entry.mtimeMs,
      size: message.entry.size ?? null
    });
  }
  if (message.type === 'hash-remove' && Array.isArray(message.paths)) {
    message.paths.forEach((relativePath) => cache.delete(relativePath));
  }
  if (message.type === 'scan') {
    void runScan();
  }
});
