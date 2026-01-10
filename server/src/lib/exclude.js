import { minimatch } from 'minimatch';
import { EXCLUDE_PATTERNS } from '../config.js';
import { toPosix } from './paths.js';

export const isExcludedPath = (relativePath) => {
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
  if (EXCLUDE_PATTERNS.length === 0) return false;
  const candidates = new Set([posixPath, posixPath.replace(/\/+$/, ''), `${posixPath}/`]);
  return EXCLUDE_PATTERNS.some((pattern) =>
    [...candidates].some((candidate) =>
      minimatch(candidate, pattern, { dot: true, matchBase: true })
    )
  );
};
