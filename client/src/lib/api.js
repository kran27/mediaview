export const API_BASE = import.meta.env.VITE_API_BASE || '';

export const buildFileUrl = (pathValue) =>
  `${API_BASE}/api/file?path=${encodeURIComponent(pathValue)}`;

export const buildThumbUrl = (pathValue, size = 'sm') =>
  `${API_BASE}/api/thumbnail?path=${encodeURIComponent(pathValue)}&size=${size}`;
