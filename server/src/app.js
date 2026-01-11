import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import { registerFileRoute } from './routes/file.js';
import { registerHashCacheRoute } from './routes/hash-cache.js';
import { registerHealthRoute } from './routes/health.js';
import { registerListRoute } from './routes/list.js';
import { registerTreeRoute } from './routes/tree.js';
import { registerThumbnailRoute } from './routes/thumbnail.js';
import { CLIENT_DIST } from './config.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');

  app.use(
    compression({
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        const type = res.getHeader('Content-Type');
        if (typeof type === 'string' && type.startsWith('video/')) return false;
        return compression.filter(req, res);
      }
    })
  );

  if (process.env.NODE_ENV === 'production') {
    app.use(
      helmet({
        crossOriginResourcePolicy: { policy: 'cross-origin' },
        contentSecurityPolicy: false
      })
    );
  }

  app.use((req, res, next) => {
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

  if (process.env.NODE_ENV === 'production' && fs.existsSync(CLIENT_DIST)) {
    const assetCacheControl = (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    };

    app.use(express.static(CLIENT_DIST, { index: false, setHeaders: assetCacheControl }));

    app.get('/', (req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });

    app.get('/*path', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        next();
        return;
      }
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  return app;
};
