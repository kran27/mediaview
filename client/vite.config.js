import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '^/(?!api|src/|@vite|@react-refresh|@id/|@fs/|node_modules/|favicon\\.ico|vite\\.svg)[^?]+\\.(?:avif|bmp|gif|heic|heif|ico|jpe?g|png|svg|tiff?|webp|m4v|mkv|mov|mp4|webm|wmv|flv|f4v|3gp|3g2|ogv|mts|m2ts|ts|vob|rm|rmvb|asf|mxf|m1v|m2v|aac|flac|m4a|mp3|ogg|wav|pdf|txt|md|json|csv|log|zip|7z|rar|tar|gz|tgz)(?:\\?.*)?$':
        'http://localhost:3001'
    }
  }
});
