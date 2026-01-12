# MediaView

Web-based file browser and media viewer inspired by h5ai. The Node backend serves a local archive directory and exposes API endpoints for listing, streaming, thumbnails, and tree hydration. The React frontend provides a folder tree, list/grid views, and a lightbox viewer.

## Features

- List, grid, and tree navigation with lightbox previews
- Path-based API endpoints for files, lists, thumbnails, and tree
- SHA-256 hash cache with background scanning and thumbnail worker
- CDN-friendly headers (ETag/Cache-Control) for file and thumbnail responses

## Structure

- `server/` Node API for directory listing and file streaming
- `client/` React UI (Vite)

## Setup

1. Point the backend at your archive directory:

```bash
export ARCHIVE_ROOT="/absolute/path/to/archive"
export ARCHIVE_NAME="archive.example.com"
export CACHE_ROOT="/absolute/path/to/cache"
```

2. Install and run the backend:

```bash
cd server
npm install
npm run dev
```

3. Install and run the frontend:

```bash
cd client
npm install
npm run dev
```

The UI runs on `http://localhost:5173` and proxies `/api` to the backend on port `3001`.

## Production build

1. Build the client:

```bash
cd server
npm run build
```

2. Start the server in production mode:

```bash
NODE_ENV=production npm start
```

The server will serve the static client from `client/dist`. You can override this with `CLIENT_DIST=/path/to/dist`.

## Docker

Build the image and run it with your archive mounted:

```bash
docker build -t mediaview .
docker run --rm -p 3001:3001 \
  -e ARCHIVE_ROOT=/archive \
  -e CACHE_ROOT=/cache \
  -e ARCHIVE_NAME="My Archive" \
  -v /absolute/path/to/archive:/archive:ro \
  -v /absolute/path/to/cache:/cache:rw \
  mediaview
```

The image includes `ffmpeg` for video thumbnail generation.

## API

- `GET /api/list/<path>`: List a directory and one level of children.
- `GET /api/file/<path>`: Stream a file (supports Range + cache headers).
- `GET /api/thumbnail/<size>/<path>`: Get a thumbnail (`sm`, `md`, `lg`).
- `GET /api/tree`: Fetch the folder tree (structure only).
- `GET /api/hash-cache`: Hash cache status.
- `GET /api/health`: Health check.

## Notes

- `ARCHIVE_ROOT` defaults to `server/archive` if not set.
- `CACHE_ROOT` defaults to `.cache` under `ARCHIVE_ROOT`.
- The backend only allows access inside `ARCHIVE_ROOT`.
- Thumbnails and hashes are stored in `CACHE_ROOT`.
- Video thumbnail generation requires `ffmpeg` to additionally be installed and available on PATH.
- For production, build the client (`npm run build`) and serve it with your static server of choice.
