import express from 'express';
import { registerFileRoute } from './routes/file.js';
import { registerHashCacheRoute } from './routes/hash-cache.js';
import { registerHealthRoute } from './routes/health.js';
import { registerListRoute } from './routes/list.js';
import { registerTreeRoute } from './routes/tree.js';
import { registerThumbnailRoute } from './routes/thumbnail.js';

export const createApp = () => {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  registerHealthRoute(app);
  registerHashCacheRoute(app);
  registerListRoute(app);
  registerTreeRoute(app);
  registerThumbnailRoute(app);
  registerFileRoute(app);

  return app;
};
