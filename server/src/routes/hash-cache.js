import { getHashCacheStatus } from '../lib/hash-cache.js';

export const registerHashCacheRoute = (app) => {
  app.get('/api/hash-cache', (req, res) => {
    res.json(getHashCacheStatus());
  });
};
