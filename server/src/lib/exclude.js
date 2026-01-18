import { EXCLUDED_PATTERNS, HIDDEN_PATTERNS } from '../config.js';
import { toPosix } from './paths.js';

export const isExcludedPathWithPatterns = (relativePath, patterns) => {
  if (!relativePath) return false;
  const posixPath = toPosix(relativePath);
  if (!patterns || patterns.length === 0) return false;
  const normalizedPath = posixPath.replace(/\/+$/, '');
  const segments = normalizedPath.split('/').filter(Boolean);
  return patterns.some((pattern) => {
    const normalizedPattern = toPosix(pattern).replace(/\/+$/, '');
    if (!normalizedPattern) return false;
    return segments.some((segment) => segment.startsWith(normalizedPattern));
  });
};

export const isExcludedPath = (relativePath) =>
  isExcludedPathWithPatterns(relativePath, EXCLUDED_PATTERNS);

export const isHiddenPath = (relativePath) =>
  isExcludedPathWithPatterns(relativePath, HIDDEN_PATTERNS);
