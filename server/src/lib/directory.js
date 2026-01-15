import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from '../config.js';
import { classifyFile } from './classify.js';
import { isExcludedPath } from './exclude.js';
import { resolveSafePath, toPosix } from './paths.js';

export const readDirectory = async (relativePath) => {
  if (isExcludedPath(relativePath)) return [];
  const absolutePath = resolveSafePath(relativePath);
  const dirEntries = await fsPromises.readdir(absolutePath, { withFileTypes: true });
  const entries = await Promise.all(
    dirEntries.map(async (dirent) => {
      const entryPath = path.join(absolutePath, dirent.name);
      const relativeEntryPath = toPosix(path.relative(ROOT_DIR, entryPath));
      if (isExcludedPath(relativeEntryPath)) {
        return null;
      }
      const entryStats = await fsPromises.stat(entryPath);
      const ext = dirent.isDirectory() ? '' : path.extname(dirent.name).toLowerCase();
      const entryType = dirent.isDirectory() ? 'dir' : classifyFile(ext);

      return {
        name: dirent.name,
        path: relativeEntryPath,
        isDir: dirent.isDirectory(),
        size: dirent.isDirectory() ? null : entryStats.size,
        ext,
        type: entryType,
      };
    })
  );

  const filteredEntries = entries.filter(Boolean);
  filteredEntries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return filteredEntries;
};
