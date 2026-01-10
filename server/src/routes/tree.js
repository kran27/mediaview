import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR, ROOT_NAME } from '../config.js';
import { isExcludedPath } from '../lib/exclude.js';
import { resolveSafePath, toPosix } from '../lib/paths.js';

const buildTree = async (relativePath, nodes) => {
  const absolutePath = resolveSafePath(relativePath);
  const entries = await fsPromises.readdir(absolutePath, { withFileTypes: true });
  const children = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const entryPath = path.join(absolutePath, entry.name);
    const relativeEntryPath = toPosix(path.relative(ROOT_DIR, entryPath));
    if (isExcludedPath(relativeEntryPath)) continue;
    children.push(relativeEntryPath);
  }

  children.sort((a, b) =>
    path.basename(a).localeCompare(path.basename(b), undefined, { sensitivity: 'base' })
  );

  nodes[relativePath] = {
    name: relativePath ? path.basename(absolutePath) : ROOT_NAME,
    path: relativePath,
    children
  };

  await Promise.all(children.map((childPath) => buildTree(childPath, nodes)));
};

export const registerTreeRoute = (app) => {
  app.get('/api/tree', async (req, res) => {
    const nodes = {};
    try {
      await buildTree('', nodes);
      res.json({
        root: { name: ROOT_NAME, path: '' },
        nodes
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to build tree', detail: error.message });
    }
  });
};
