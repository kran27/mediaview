import 'dotenv/config';
import { createApp } from './src/app.js';
import { PORT, ROOT_DIR } from './src/config.js';
import { startThumbnailWorker } from './src/lib/thumbnails.js';
import {
  loadHashCache,
  startHashCacheFileWatcher,
  startHashCacheWorker,
} from './src/lib/hash-cache.js';

const mode = process.argv[2] || 'server';
const validModes = new Set(['server', 'worker', 'combined']);

if (!validModes.has(mode)) {
  console.error(`Unknown mode "${mode}". Use "server" or "worker".`);
  process.exit(1);
}

void (async () => {
  await loadHashCache();

  if (mode === 'server') {
    await startHashCacheFileWatcher();
    const app = createApp();
    app.listen(PORT, () => {
      console.log(`MediaView server listening on port ${PORT}`);
      console.log(`Archive root: ${ROOT_DIR}`);
    });
    return;
  }

  if (mode === 'worker') {
    await startHashCacheWorker();
    await startThumbnailWorker();
    console.log('MediaView workers running');
    return;
  }

  await startHashCacheWorker();
  await startThumbnailWorker();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`MediaView server listening on port ${PORT}`);
    console.log(`Archive root: ${ROOT_DIR}`);
  });
  console.log('MediaView workers running');
})();
