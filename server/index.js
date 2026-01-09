import { createApp } from './src/app.js';
import { PORT, ROOT_DIR } from './src/config.js';
import { startThumbnailWorker } from './src/lib/thumbnails.js';

const app = createApp();

startThumbnailWorker();

app.listen(PORT, () => {
  console.log(`MediaView server listening on port ${PORT}`);
  console.log(`Archive root: ${ROOT_DIR}`);
});
