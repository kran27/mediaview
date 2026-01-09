# MediaView

Web-based file browser and media viewer inspired by h5ai. The Node backend serves a local archive directory, and the React frontend provides a folder tree, list/grid views, and a preview pane.

## Structure

- `server/` Node API for directory listing and file streaming
- `client/` React UI (Vite)

## Setup

1. Point the backend at your archive directory:

```bash
export ARCHIVE_ROOT="/absolute/path/to/archive"
export ARCHIVE_NAME="archive.mirroredsearcharchive.org"
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

## Notes

- `ARCHIVE_ROOT` defaults to `server/archive` if not set.
- The backend only allows access inside `ARCHIVE_ROOT`.
- For production, build the client (`npm run build`) and serve it with your static server of choice.
