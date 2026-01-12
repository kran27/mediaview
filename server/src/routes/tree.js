import { ROOT_NAME } from '../config.js';
import { getDirectoryTree } from '../lib/hash-cache.js';

export const registerTreeRoute = (app) => {
  app.get('/api/tree', (req, res) => {
    try {
      const nodes = getDirectoryTree();
      res.json({
        root: { name: ROOT_NAME, path: '' },
        nodes
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to build tree', detail: error.message });
    }
  });
};
