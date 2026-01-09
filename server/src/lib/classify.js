import path from 'node:path';

export const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.avif']);
export const VIDEO_EXTS = new Set(['.mp4', '.m4v', '.webm', '.mov', '.mkv', '.avi', '.mpg', '.mpeg']);
export const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg']);
export const DOC_EXTS = new Set(['.pdf']);
export const TEXT_EXTS = new Set(['.txt', '.md', '.json', '.csv', '.log']);

export const classifyFile = (ext) => {
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  if (AUDIO_EXTS.has(ext)) return 'audio';
  if (DOC_EXTS.has(ext)) return 'document';
  if (TEXT_EXTS.has(ext)) return 'text';
  return 'binary';
};

export const isImagePath = (relativePath) =>
  IMAGE_EXTS.has(path.extname(relativePath).toLowerCase());

export const isVideoPath = (relativePath) =>
  VIDEO_EXTS.has(path.extname(relativePath).toLowerCase());

export const isThumbablePath = (relativePath) => {
  const ext = path.extname(relativePath).toLowerCase();
  return IMAGE_EXTS.has(ext) || VIDEO_EXTS.has(ext);
};
