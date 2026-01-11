export const API_BASE = import.meta.env.VITE_API_BASE || '';

const encodePathSegments = (pathValue) =>
  pathValue
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export const buildFileUrl = (pathValue) => {
  const encodedPath = encodePathSegments(pathValue || '');
  return `${API_BASE}/api/file/${encodedPath}`;
};

export const buildThumbUrl = (pathValue, size = 'sm') => {
  const encodedPath = encodePathSegments(pathValue || '');
  return `${API_BASE}/api/thumbnail/${size}/${encodedPath}`;
};
