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
  if (size === 'jpg') {
    return `${API_BASE}/api/thumbnail/jpg/${encodedPath}`;
  }
  return `${API_BASE}/api/thumbnail/${size}/${encodedPath}`;
};

export const buildListUrl = (pathValue = '') => {
  const encodedPath = encodePathSegments(pathValue);
  return encodedPath ? `${API_BASE}/api/list/${encodedPath}` : `${API_BASE}/api/list`;
};

export const fetchList = async (pathValue = '', options = {}) => {
  const { signal } = options;
  const url = buildListUrl(pathValue);
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      if (response.status === 404) {
        throw createRequestError('Requested content could not be found.', response.status);
      }
      throw createRequestError(`Failed to load ${pathValue || 'root'}`, response.status);
    }
    return response.json();
  } catch (error) {
    throw normalizeRequestError(error, `Failed to load ${pathValue || 'root'}`);
  }
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
