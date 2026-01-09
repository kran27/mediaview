import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
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

const toPosix = (value) => value.split(path.sep).join('/');

const isExcludedPath = (relativePath) => {
  if (!relativePath) return false;
  const posixPath = toPosix(relativePath);
  if (posixPath === '.thumbnail' || posixPath.startsWith('.thumbnail/')) {
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
    const hash = crypto.createHash('sha1');
    const stream = fs.createReadStream(absolutePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const ensureThumbDir = async () => {
  await fsPromises.mkdir(thumbDir, { recursive: true });
};

const enqueuePaths = (paths) => {
  paths.forEach((relativePath) => {
    if (!relativePath || pending.has(relativePath) || isExcludedPath(relativePath)) return;
    pending.add(relativePath);
    queue.push(relativePath);
  });
  if (!processing) {
    void processQueue();
  }
};

const generateThumbnails = async (relativePath) => {
  const absolutePath = path.join(rootDir, relativePath);
  const stats = await fsPromises.stat(absolutePath);
  if (!stats.isFile()) return;
  const ext = path.extname(relativePath).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return;

  const hash = await hashFile(absolutePath);
  const originalName = path.basename(relativePath);

  for (const [variant, width] of sizeEntries) {
    const thumbName = `${hash}-${variant}-${originalName}${thumbExt}`;
    const thumbPath = path.join(thumbDir, thumbName);
    if (fs.existsSync(thumbPath)) continue;
    await sharp(absolutePath)
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 50, effort: 6, chromaSubsampling: '4:2:0' })
      .toFile(thumbPath);
  }

  parentPort?.postMessage({
    type: 'hashed',
    path: relativePath,
    hash,
    mtimeMs: stats.mtimeMs,
    size: stats.size
  });
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

const generateVideoThumbnails = async (relativePath) => {
  if (!ensureFfmpeg()) return;
  const absolutePath = path.join(rootDir, relativePath);
  const stats = await fsPromises.stat(absolutePath);
  if (!stats.isFile()) return;
  const ext = path.extname(relativePath).toLowerCase();
  if (!VIDEO_EXTS.has(ext)) return;

  const hash = await hashFile(absolutePath);
  const originalName = path.basename(relativePath);
  const frameBuffer = await extractVideoFrame(absolutePath);

  for (const [variant, width] of sizeEntries) {
    const thumbName = `${hash}-${variant}-${originalName}${thumbExt}`;
    const thumbPath = path.join(thumbDir, thumbName);
    if (fs.existsSync(thumbPath)) continue;
    await sharp(frameBuffer)
      .resize({ width, height: width, fit: 'inside', withoutEnlargement: true })
      .avif({ quality: 32, effort: 4, chromaSubsampling: '4:2:0' })
      .toFile(thumbPath);
  }

  parentPort?.postMessage({
    type: 'hashed',
    path: relativePath,
    hash,
    mtimeMs: stats.mtimeMs,
    size: stats.size
  });
};

const processQueue = async () => {
  processing = true;
  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) continue;
    try {
      const ext = path.extname(next).toLowerCase();
      if (VIDEO_EXTS.has(ext)) {
        await generateVideoThumbnails(next);
      } else {
        await generateThumbnails(next);
      }
    } catch (error) {
      // Skip failures and continue processing.
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
  if (message.type === 'enqueue' && Array.isArray(message.paths)) {
    enqueuePaths(message.paths);
  }
  if (message.type === 'scan') {
    void scanTree();
  }
});
