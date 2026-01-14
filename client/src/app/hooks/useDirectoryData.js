import { useEffect, useMemo, useRef, useState } from 'react';
import { isViewableEntry } from '../../lib/fileTypes.js';
import { useDirectoryTree } from './useDirectoryTree.js';
import { useDirectoryCache } from './useDirectoryCache.js';

export const useDirectoryData = () => {
  const [directory, setDirectory] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid');
  const [zoomLevel, setZoomLevel] = useState('md');
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [status, setStatus] = useState({ loading: true, error: null });
  const {
    tree,
    treeHydratedRef,
    treePrefetchingRef,
    updateTreeWithEntries,
    expandAncestors,
    toggleNode,
    collapseAll
  } = useDirectoryTree();
  const {
    applyListing,
    fetchList,
    getCachedListing,
    getLastResolvablePath,
    hydratePathChain,
    resolveLastGoodPath
  } = useDirectoryCache({ updateTreeWithEntries });
  const currentPathRef = useRef('');
  const [lastGoodPath, setLastGoodPath] = useState('');
  const resolvePathRef = useRef(0);

  const setLastGoodPathValue = (value, options = {}) => {
    const { allowEmpty = false } = options;
    if (value || allowEmpty) {
      setLastGoodPath(value);
    }
  };

  const getSelection = (entries, selectPath) => {
    if (!selectPath) return null;
    return entries.find((entry) => entry.path === selectPath || entry.name === selectPath) || null;
  };

  const applyDirectoryState = (data, pathValue, selection) => {
    setDirectory(data);
    setCurrentPath(pathValue);
    setSelected(selection);
    expandAncestors(pathValue, data.root?.name || 'Archive');
    setStatus({ loading: false, error: null });
  };

  const loadDirectory = async (pathValue, options = {}) => {
    const { selectPath = '' } = options;
    const cached = getCachedListing(pathValue);
    if (!cached && pathValue && treeHydratedRef.current) {
      expandAncestors(pathValue, tree['']?.name || 'Archive');
    }
    if (cached) {
      const selection = getSelection(cached.entries, selectPath);
      const shouldLightbox = Boolean(selectPath) && isViewableEntry(selection);
      if (pathValue) {
        setLastGoodPathValue(pathValue);
      }
      applyDirectoryState(cached, pathValue, selection);
      if (pathValue) {
        void hydratePathChain(pathValue);
      }
      return { selection, shouldLightbox };
    }
    setStatus({ loading: true, error: null });
    setCurrentPath(pathValue);
    if (pathValue && treeHydratedRef.current) {
      expandAncestors(pathValue, tree['']?.name || 'Archive');
    }
    try {
      const listPromise = fetchList(pathValue);
      if (pathValue) {
        void hydratePathChain(pathValue);
      }
      const data = await listPromise;
      applyListing(pathValue, data, { expand: true });
      const selection = getSelection(data.entries, selectPath);
      const shouldLightbox = Boolean(selectPath) && isViewableEntry(selection);
      if (pathValue) {
        setLastGoodPathValue(pathValue);
      }
      applyDirectoryState(data, pathValue, selection);
      return { selection, shouldLightbox };
    } catch (error) {
      const fallbackPath = getLastResolvablePath(pathValue);
      setLastGoodPathValue(fallbackPath, { allowEmpty: true });
      resolvePathRef.current += 1;
      const requestId = resolvePathRef.current;
      void resolveLastGoodPath(pathValue, () => resolvePathRef.current === requestId)
        .then((lastSuccess) => {
          if (lastSuccess === null) return;
          setLastGoodPathValue(lastSuccess, { allowEmpty: true });
        });
      setStatus({ loading: false, error: error.message });
      return { selection: null, shouldLightbox: false };
    }
  };

  const loadChildren = async (pathValue) => {
    try {
      const data = await fetchList(pathValue, {
        background: true,
        onBackgroundUpdate: (activePath, listing) => {
          if (currentPathRef.current !== activePath) return;
          setDirectory(listing);
          setSelected((prev) =>
            prev && listing.entries.find((entry) => entry.path === prev.path) ? prev : null
          );
        }
      });
      applyListing(pathValue, data, { expand: false });
    } catch (error) {
      setStatus({ loading: false, error: error.message });
    }
  };

  const handleToggle = (pathValue) => {
    const node = tree[pathValue];
    if (!node) return;
    if (
      !node.expanded &&
      node.children === null &&
      !treeHydratedRef.current &&
      !treePrefetchingRef.current
    ) {
      loadChildren(pathValue);
    }
    toggleNode(pathValue);
  };

  const handleSortClick = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(key);
    setSortDir('asc');
  };

  useEffect(() => {
    currentPathRef.current = currentPath;
  }, [currentPath]);

  const filteredEntries = useMemo(() => {
    if (!directory) return [];
    const term = search.trim().toLowerCase();
    const entries = term
      ? directory.entries.filter((entry) => entry.name.toLowerCase().includes(term))
      : directory.entries;

    const sorted = [...entries].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      let compare = 0;
      if (sortKey === 'name') {
        compare = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sortKey === 'size') {
        compare = (a.size || 0) - (b.size || 0);
      }
      if (compare === 0) {
        compare = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
      return sortDir === 'asc' ? compare : -compare;
    });

    return sorted;
  }, [directory, search, sortKey, sortDir]);

  return {
    directory,
    currentPath,
    lastGoodPath,
    selected,
    setSelected,
    status,
    tree,
    search,
    setSearch,
    viewMode,
    setViewMode,
    zoomLevel,
    setZoomLevel,
    sortKey,
    sortDir,
    handleSortClick,
    filteredEntries,
    loadDirectory,
    handleToggle,
    collapseAll
  };
};
