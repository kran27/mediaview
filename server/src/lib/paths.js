import path from 'node:path';
import { ROOT_DIR, ROOT_PREFIX } from '../config.js';

const MAX_REQUEST_PATH = 4096;

export const toPosix = (value) => value.split(path.sep).join('/');

export const normalizeRequestPath = (value = '') => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || trimmed === '/') {
    return '';
  }
  return trimmed.replace(/\\/g, '/').replace(/^\/+/, '');
};

export const decodePathSegments = (rawPath) => {
  if (Array.isArray(rawPath)) {
    return rawPath.join('/');
  }
  try {
    return rawPath
      .split('/')
      .filter(Boolean)
      .map((segment) => {
        try {
          return decodeURIComponent(segment);
        } catch {
          // If decoding fails, treat as invalid
          const decodeError = new Error('Invalid path encoding');
          decodeError.statusCode = 400;
          throw decodeError;
        }
      })
      .join('/');
  } catch {
    const decodeError = new Error('Invalid path encoding');
    decodeError.statusCode = 400;
    throw decodeError;
  }
};

export const sanitizeRequestPath = (value = '') => {
  const normalized = normalizeRequestPath(value);
  if (normalized.length > MAX_REQUEST_PATH) {
    const error = new Error('Path is too long');
    error.statusCode = 414;
    throw error;
  }
  if (normalized.includes('\0')) {
    const error = new Error('Path contains invalid characters');
    error.statusCode = 400;
    throw error;
  }
  const segments = normalized.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    const error = new Error('Path contains invalid segments');
    error.statusCode = 400;
    throw error;
  }
  // Allow all other characters supported by UNIX filesystems
  return normalized;
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
