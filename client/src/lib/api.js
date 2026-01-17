import { createRequestError, normalizeRequestError } from './request.js';

export const API_BASE = import.meta.env.VITE_API_BASE || '';

const encodePathSegments = (pathValue) =>
  pathValue
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

export const buildFileUrl = (pathValue) => {
  const encodedPath = encodePathSegments(pathValue || '');
  return `${API_BASE}/${encodedPath}`;
};

export const buildThumbUrl = (pathValue, size = 'sm') => {
  const encodedPath = encodePathSegments(pathValue || '');
  return `${API_BASE}/api/thumbnail/${size}/${encodedPath}`;
};

export const searchArchive = async (query) => {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  const url = `${API_BASE}/api/search?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw createRequestError('Failed to search', response.status);
    }
    return response.json();
  } catch (error) {
    throw normalizeRequestError(error, 'Failed to search');
  }
};
