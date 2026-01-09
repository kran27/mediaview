import path from 'node:path';
import { ROOT_DIR, ROOT_PREFIX } from '../config.js';

export const toPosix = (value) => value.split(path.sep).join('/');

export const normalizeRequestPath = (value = '') => {
  const trimmed = value.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  return trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
};

export const resolveSafePath = (requestPath) => {
  const resolved = path.resolve(ROOT_DIR, requestPath);
  if (resolved !== ROOT_DIR && !resolved.startsWith(ROOT_PREFIX)) {
    const error = new Error('Path escapes archive root');
    error.statusCode = 400;
    throw error;
  }
  return resolved;
};
