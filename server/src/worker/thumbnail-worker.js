import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parentPort, workerData } from 'node:worker_threads';
import sharp from 'sharp';
import { minimatch } from 'minimatch';

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif']);
const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.avi', '.mpg', '.mpeg']);
const { rootDir, thumbDir, excludePatterns, sizes, thumbExt } = workerData;
const sizeEntries = Object.entries(sizes);
const pending = new Set();
const queue = [];
let processing = false;
let ffmpegAvailable = null;
const hashCache = new Map();

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

const ensureThumbDir = async () => {
  await fsPromises.mkdir(thumbDir, { recursive: true });
};

const dropPending = (relativePath) => {
  if (!relativePath) return;
  pending.delete(relativePath);
  for (let index = queue.length - 1; index >= 0; index -= 1) {
    if (queue[index] === relativePath) {
      queue.splice(index, 1);
    }
  }
};

const deleteThumbFiles = async (hash, originalName) => {
  if (!hash || !originalName) return;
  let deletedCount = 0;
  await Promise.all(
    sizeEntries.map(([variant]) => {
      const thumbName = `${hash}-${variant}-${originalName}${thumbExt}`;
      const thumbPath = path.join(thumbDir, thumbName);
      return fsPromises.unlink(thumbPath)
        .then(() => {
          deletedCount += 1;
        })
        .catch((error) => {
          if (error?.code === 'ENOENT') return;
          console.error('Thumbnail worker failed to delete thumbnail', error);
        });
    })
  );
  return deletedCount;
};

const enqueueEntries = (entries) => {
  entries.forEach((entry) => {
    const relativePath = entry?.path;
    if (!relativePath || !entry?.hash || pending.has(relativePath) || isExcludedPath(relativePath)) {
      return;
    }
    hashCache.set(relativePath, {
      hash: entry.hash,
      mtimeMs: entry.mtimeMs,
      size: entry.size ?? null
    });
    pending.add(relativePath);
    queue.push(relativePath);
  });
  if (!processing) {
    void processQueue();
  }
};

const enqueuePaths = (paths) => {
  const entries = [];
  paths.forEach((relativePath) => {
    const cached = hashCache.get(relativePath);
    if (!cached?.hash) return;
    entries.push({ path: relativePath, ...cached });
  });
  enqueueEntries(entries);
};

const generateThumbnails = async (relativePath, hash, options = {}) => {
  const absolutePath = path.join(rootDir, relativePath);
  const stats = await fsPromises.stat(absolutePath);
  if (!stats.isFile()) return;
  const ext = path.extname(relativePath).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return;

  const cachedHash = hash || hashCache.get(relativePath)?.hash;
  if (!cachedHash) return;
  const originalName = path.basename(relativePath);
  const variants = options.force
    ? sizeEntries
    : sizeEntries.filter(([variant]) => {
      const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
      return !fs.existsSync(path.join(thumbDir, thumbName));
    });
  if (variants.length === 0) {
    return { hash: cachedHash, created: 0 };
  }

  let created = 0;
  for (const [variant, width] of variants) {
    const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
    const thumbPath = path.join(thumbDir, thumbName);
    await sharp(absolutePath)
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 40, effort: 6, chromaSubsampling: '4:2:0' })
      .toFile(thumbPath);
    created += 1;
  }

  return { hash: cachedHash, created };
};

const ensureFfmpeg = () => {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  ffmpegAvailable = result.status === 0;
  return ffmpegAvailable;
};

const extractVideoFrame = (absolutePath) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    const process = spawn('ffmpeg', [
      '-ss',
      '00:00:03',
      '-i',
      absolutePath,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      'pipe:1'
    ]);
    process.stdout.on('data', (chunk) => chunks.push(chunk));
    process.stdout.on('error', reject);
    process.stderr.on('data', () => {});
    process.on('error', reject);
    process.on('close', (code) => {
      if (code !== 0 || chunks.length === 0) {
        reject(new Error('ffmpeg failed'));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });

const generateVideoThumbnails = async (relativePath, hash, options = {}) => {
  if (!ensureFfmpeg()) return;
  const absolutePath = path.join(rootDir, relativePath);
  const stats = await fsPromises.stat(absolutePath);
  if (!stats.isFile()) return;
  const ext = path.extname(relativePath).toLowerCase();
  if (!VIDEO_EXTS.has(ext)) return;

  const cachedHash = hash || hashCache.get(relativePath)?.hash;
  if (!cachedHash) return;
  const originalName = path.basename(relativePath);
  const variants = options.force
    ? sizeEntries
    : sizeEntries.filter(([variant]) => {
      const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
      return !fs.existsSync(path.join(thumbDir, thumbName));
    });
  if (variants.length === 0) {
    return { hash: cachedHash, created: 0 };
  }
  const frameBuffer = await extractVideoFrame(absolutePath);

  let created = 0;
  for (const [variant, width] of variants) {
    const thumbName = `${cachedHash}-${variant}-${originalName}${thumbExt}`;
    const thumbPath = path.join(thumbDir, thumbName);
    await sharp(frameBuffer)
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 40, effort: 6, chromaSubsampling: '4:2:0' })
      .toFile(thumbPath);
    created += 1;
  }

  return { hash: cachedHash, created };
};

const processQueue = async () => {
  processing = true;
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) continue;
    try {
      const ext = path.extname(next).toLowerCase();
      const cachedHash = hashCache.get(next)?.hash;
      if (VIDEO_EXTS.has(ext)) {
        await generateVideoThumbnails(next, cachedHash);
      } else {
        await generateThumbnails(next, cachedHash);
      }
    } catch (error) {
      console.error('Thumbnail worker failed to generate thumbnail', error);
    } finally {
      pending.delete(next);
    }
  }
  processing = false;
};

const scanTree = async () => {
  const stack = [''];
  while (stack.length > 0) {
    const current = stack.pop();
    const absolutePath = path.join(rootDir, current);
    let dirEntries;
    try {
      dirEntries = await fsPromises.readdir(absolutePath, { withFileTypes: true });
    } catch (error) {
      console.error('Thumbnail worker failed to read directory', error);
      continue;
    }
    for (const dirent of dirEntries) {
      const relativePath = toPosix(path.join(current, dirent.name));
      if (isExcludedPath(relativePath)) {
        continue;
      }
      if (dirent.isDirectory()) {
        stack.push(relativePath);
      } else if (dirent.isFile()) {
        enqueuePaths([relativePath]);
      }
    }
  }
};

await ensureThumbDir();

parentPort?.on('message', (message) => {
  if (!message) return;
  if (message.type === 'enqueue') {
    if (Array.isArray(message.entries)) {
      enqueueEntries(message.entries);
    } else if (Array.isArray(message.paths)) {
      enqueuePaths(message.paths);
    }
  }
  if (message.type === 'hash-update' && message.entry?.path) {
    hashCache.set(message.entry.path, {
      hash: message.entry.hash,
      mtimeMs: message.entry.mtimeMs,
      size: message.entry.size ?? null
    });
  }
  if (message.type === 'sync' && Array.isArray(message.entries) && Array.isArray(message.removals)) {
    const updates = message.entries;
    const removals = message.removals;
    void (async () => {
      let createdCount = 0;
      let deletedCount = 0;
      for (const entry of updates) {
        if (!entry?.path || !entry?.hash) continue;
        dropPending(entry.path);
        const previousHash = entry.previousHash || hashCache.get(entry.path)?.hash;
        if (previousHash && previousHash !== entry.hash) {
          deletedCount += await deleteThumbFiles(previousHash, path.basename(entry.path));
        }
        hashCache.set(entry.path, {
          hash: entry.hash,
          mtimeMs: entry.mtimeMs,
          size: entry.size ?? null
        });
        const ext = path.extname(entry.path).toLowerCase();
        if (IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext)) {
          const force = !previousHash || previousHash !== entry.hash;
          if (VIDEO_EXTS.has(ext)) {
            const result = await generateVideoThumbnails(entry.path, entry.hash, { force });
            createdCount += result?.created || 0;
          } else {
            const result = await generateThumbnails(entry.path, entry.hash, { force });
            createdCount += result?.created || 0;
          }
        }
      }
      for (const pathValue of removals) {
        const removalPath = pathValue?.path || pathValue;
        if (!removalPath) continue;
        dropPending(removalPath);
        const removalHash = pathValue?.hash || hashCache.get(removalPath)?.hash;
        if (removalHash) {
          deletedCount += await deleteThumbFiles(removalHash, path.basename(removalPath));
        }
        hashCache.delete(removalPath);
      }
      if (createdCount > 0 || deletedCount > 0) {
        console.log(
          `Thumbnail worker: ${createdCount} created, ${deletedCount} removed`
        );
      }
    })();
  }
  if (message.type === 'scan') {
    void scanTree();
  }
});
