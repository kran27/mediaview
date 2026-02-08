import fs from 'node:fs';
import { SITEMAP_FILE } from '../config.js';

export const registerSitemapRoute = (app) => {
  const gzPath = `${SITEMAP_FILE}.gz`;

  app.get('/sitemap.xml.gz', (req, res) => {
    if (!fs.existsSync(gzPath)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(gzPath);
  });

  app.get('/sitemap.xml', (req, res) => {
    const acceptEncoding = String(req.headers['accept-encoding'] || '');
    if (acceptEncoding.includes('gzip') && fs.existsSync(gzPath)) {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(gzPath);
      return;
    }
    if (!fs.existsSync(SITEMAP_FILE)) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(SITEMAP_FILE);
  });
};
