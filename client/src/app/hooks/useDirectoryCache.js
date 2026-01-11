import { useCallback, useRef } from 'react';
import { API_BASE } from '../../lib/api.js';
import { getBasename } from '../../lib/format.js';
import { buildStats } from '../../lib/stats.js';

const encodePathSegments = (pathValue) =>
  pathValue
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

const getPathChain = (pathValue) => {
  const segments = pathValue.split('/').filter(Boolean);
  const paths = [''];
  let current = '';
  segments.forEach((segment) => {
    current = current ? `${current}/${segment}` : segment;
    paths.push(current);
  });
  return paths;
};

export const useDirectoryCache = ({ updateTreeWithEntries }) => {
  const cacheRef = useRef(new Map());

  const getCachedListing = useCallback((pathValue) => cacheRef.current.get(pathValue), []);

  const applyListing = useCallback((pathValue, data, options = {}) => {
    cacheRef.current.set(pathValue, data);
    updateTreeWithEntries(pathValue, data.entries, {
      expand: options.expand ?? true,
      rootLabel: data.root?.name
    });
    if (data.children) {
      const rootLabel = data.root?.name;
      Object.entries(data.children).forEach(([childPath, childEntries]) => {
        if (!Array.isArray(childEntries)) return;
        const childName = childPath ? getBasename(childPath) : rootLabel || 'Archive';
        const childData = {
          root: data.root,
          current: {
            name: childName,
            path: childPath
          },
          stats: buildStats(childEntries),
          entries: childEntries
        };
        cacheRef.current.set(childPath, childData);
        updateTreeWithEntries(childPath, childEntries, {
          expand: false,
          rootLabel
        });
      });
    }
  }, [updateTreeWithEntries]);

  const requestList = useCallback(async (pathValue) => {
    const encodedPath = encodePathSegments(pathValue || '');
    const url = encodedPath ? `${API_BASE}/api/list/${encodedPath}` : `${API_BASE}/api/list`;
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Requested content could not be found.');
      }
      throw new Error(`Failed to load ${pathValue || 'root'}`);
    }
    return response.json();
  }, []);

  const fetchList = useCallback(async (pathValue, options = {}) => {
    const { force = false, background = false, onBackgroundUpdate } = options;
    const cached = getCachedListing(pathValue);
    if (cached && !force) {
      if (background) {
        void requestList(pathValue)
          .then((data) => {
            applyListing(pathValue, data, { expand: false });
            if (onBackgroundUpdate) {
              onBackgroundUpdate(pathValue, data);
            }
          })
          .catch(() => {});
      }
      return cached;
    }
    return requestList(pathValue);
  }, [applyListing, getCachedListing, requestList]);

  const hydratePathChain = useCallback(async (pathValue) => {
    if (!pathValue) return;
    const chain = getPathChain(pathValue);
    const chainToFetch = chain.slice(0, -1);
    chainToFetch.forEach((chainPath) => {
      const cached = getCachedListing(chainPath);
      if (!cached) return;
      updateTreeWithEntries(chainPath, cached.entries, {
        expand: true,
        rootLabel: cached.root?.name
      });
    });

    let index = 0;
    while (index < chainToFetch.length) {
      const chainPath = chainToFetch[index];
      if (!getCachedListing(chainPath)) {
        try {
          const data = await requestList(chainPath);
          applyListing(chainPath, data, { expand: true });
        } catch {
          // ignore background failures
        }
      }

      const nextPath = chainToFetch[index + 1];
      if (nextPath && getCachedListing(nextPath)) {
        const cachedNext = getCachedListing(nextPath);
        if (cachedNext) {
          updateTreeWithEntries(nextPath, cachedNext.entries, {
            expand: true,
            rootLabel: cachedNext.root?.name
          });
        }
        index += 2;
        continue;
      }

      index += 1;
    }
  }, [applyListing, getCachedListing, requestList, updateTreeWithEntries]);

  const getLastResolvablePath = useCallback((pathValue) => {
    const chain = getPathChain(pathValue);
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const candidate = chain[index];
      if (getCachedListing(candidate)) {
        return candidate;
      }
    }
    return '';
  }, [getCachedListing]);

  const resolveLastGoodPath = useCallback(async (pathValue, shouldContinue) => {
    const chain = getPathChain(pathValue);
    let lastSuccess = '';
    for (const chainPath of chain) {
      if (!shouldContinue()) return null;
      try {
        const data = await fetchList(chainPath);
        if (!shouldContinue()) return null;
        applyListing(chainPath, data, { expand: true });
        lastSuccess = chainPath;
      } catch {
        break;
      }
    }
    if (!shouldContinue()) return null;
    return lastSuccess;
  }, [applyListing, fetchList]);

  return {
    applyListing,
    fetchList,
    getCachedListing,
    getLastResolvablePath,
    hydratePathChain,
    resolveLastGoodPath
  };
};
