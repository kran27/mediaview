import path from 'node:path';

export const PORT = process.env.PORT || 3001;
export const ROOT_DIR = process.env.ARCHIVE_ROOT
  ? path.resolve(process.env.ARCHIVE_ROOT)
  : path.resolve(process.cwd(), 'archive');
export const ROOT_NAME = process.env.ARCHIVE_NAME || path.basename(ROOT_DIR);
export const ROOT_PREFIX = ROOT_DIR.endsWith(path.sep) ? ROOT_DIR : `${ROOT_DIR}${path.sep}`;
export const THUMB_DIR = path.join(ROOT_DIR, '.cache', 'thumbnails');
export const THUMB_EXT = '.avif';
export const THUMB_SIZES = {
  sm: 200,
  md: 480,
  lg: 960
};
export const EXCLUDE_PATTERNS = (process.env.EXCLUDE_PATTERNS || '')
  .split(',')
  .map((pattern) => pattern.trim())
  .filter(Boolean);
