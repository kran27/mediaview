import { useEffect, useRef, useState } from 'react';
import { searchArchive } from '../../lib/api.js';
import { isViewableEntry } from '../../lib/fileTypes.js';
import { useDirectoryTree } from './useDirectoryTree.js';
import { useDirectoryCache } from './useDirectoryCache.js';


export const useDirectoryData = () => {
  const readStoredValue = (key) => {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  };

  const writeStoredValue = (key, value) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore storage write failures (private mode, blocked storage, etc.)
    }
  };

  const viewModeKey = 'mediaview:viewMode';
  const zoomLevelKey = 'mediaview:zoomLevel';
  const [directory, setDirectory] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [selected, setSelected] = useState(null);
  const [pendingSelection, setPendingSelection] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState({
    loading: false,
    error: null,
    truncated: false,
    retryable: false,
  });
  const [searchRetryToken, setSearchRetryToken] = useState(0);
  const [viewMode, setViewMode] = useState(() => {
    const stored = readStoredValue(viewModeKey);
    return stored === 'list' || stored === 'grid' ? stored : 'grid';
  });
  const [zoomLevel, setZoomLevel] = useState(() => {
    const stored = readStoredValue(zoomLevelKey);
    return stored === 'sm' || stored === 'md' || stored === 'lg' ? stored : 'md';
  });
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [status, setStatus] = useState({
    loading: true,
    error: null,
    retryable: false,
    code: null
  });
  const {
    tree,
    treeStatus,
    treeHydratedRef,
    treePrefetchingRef,
    updateTreeWithEntries,
    expandAncestors,
    toggleNode,
    collapseAll,
    retryTree
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

  const submitSearch = (nextValue) => {
    const trimmed = nextValue.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearchStatus({ loading: false, error: null, truncated: false, retryable: false });
    }
    if (trimmed) {
      setSearchResults([]);
      setSearchStatus({ loading: true, error: null, truncated: false, retryable: false });
    }
    setSearchQuery(trimmed);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSearchStatus({ loading: false, error: null, truncated: false, retryable: false });
    setSearchRetryToken(0);
  };

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

  const applyDirectoryState = (data, pathValue, selection, selectPath, preserveSelection = false) => {
    setDirectory(data);
    setCurrentPath(pathValue);
    if (selection) {
      setSelected(selection);
      setPendingSelection('');
    } else if (!selectPath) {
      if (!preserveSelection) {
        setSelected(null);
      }
      setPendingSelection('');
    }
    expandAncestors(pathValue, data.root?.name || 'Archive');
    setStatus({ loading: false, error: null, retryable: false, code: null });
  };

  const loadDirectory = async (pathValue, options = {}) => {
    const { selectPath = '', openLightbox = true, force = false } = options;
    const preserveSelection = !selectPath && pathValue === currentPathRef.current;
    setPendingSelection(selectPath || '');
    if (selectPath) {
      setSelected({ path: selectPath });
    } else if (!preserveSelection) {
      setSelected(null);
    }
    const cached = getCachedListing(pathValue);
    if (!cached && pathValue && treeHydratedRef.current) {
      expandAncestors(pathValue, tree['']?.name || 'Archive');
    }
    if (cached && !force) {
      const selection = getSelection(cached.entries, selectPath);
      const shouldLightbox = openLightbox && Boolean(selectPath) && isViewableEntry(selection);
      if (pathValue) {
        setLastGoodPathValue(pathValue);
      }
      applyDirectoryState(cached, pathValue, selection, selectPath, preserveSelection);
      prefetchMissingChildren(cached.entries);
      if (pathValue) {
        void hydratePathChain(pathValue);
      }
      return { selection, shouldLightbox };
    }
    setStatus({ loading: true, error: null, retryable: false, code: null });
    setCurrentPath(pathValue);
    if (pathValue && treeHydratedRef.current) {
      expandAncestors(pathValue, tree['']?.name || 'Archive');
    }
    try {
      const listPromise = fetchList(pathValue, { force });
      if (pathValue) {
        void hydratePathChain(pathValue);
      }
      const data = await listPromise;
      applyListing(pathValue, data, { expand: true });
      const selection = getSelection(data.entries, selectPath);
      const shouldLightbox = openLightbox && Boolean(selectPath) && isViewableEntry(selection);
      if (pathValue) {
        setLastGoodPathValue(pathValue);
      }
      applyDirectoryState(data, pathValue, selection, selectPath, preserveSelection);
      prefetchMissingChildren(data.entries);
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
      setStatus({
        loading: false,
        error: error.message,
        retryable: Boolean(error.retryable),
        code: Number.isFinite(error?.status) ? error.status : null
      });
      return { selection: null, shouldLightbox: false };
    }
  };

  const loadChildren = async (pathValue, options = {}) => {
    const { silent = false } = options;
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
      if (silent) return;
      setStatus({
        loading: false,
        error: error.message,
        retryable: Boolean(error.retryable),
        code: Number.isFinite(error?.status) ? error.status : null
      });
    }
  };

  const prefetchMissingChildren = (entries) => {
    if (!Array.isArray(entries)) return;
    entries
      .filter((entry) => entry?.isDir)
      .map((entry) => entry.path)
      .filter((childPath) => childPath && !getCachedListing(childPath))
      .forEach((childPath) => {
        void loadChildren(childPath, { silent: true });
      });
  };

  const handleToggle = (pathValue) => {
    const node = tree[pathValue];
    if (!node) return;
    if (!node.expanded && Array.isArray(node.children)) {
      node.children
        .filter((childPath) => !getCachedListing(childPath))
        .forEach((childPath) => {
          void loadChildren(childPath, { silent: true });
        });
    }
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

  useEffect(() => {
    let isActive = true;
    if (!searchQuery) return undefined;
    searchArchive(searchQuery)
      .then((data) => {
        if (!isActive) return;
        const results = Array.isArray(data.results) ? data.results : [];
        setSearchResults(results);
        setSearchStatus({
          loading: false,
          error: null,
          truncated: Boolean(data.truncated),
          retryable: false,
        });
      })
      .catch((error) => {
        if (!isActive) return;
        setSearchResults([]);
        setSearchStatus({
          loading: false,
          error: error.message,
          truncated: false,
          retryable: Boolean(error.retryable)
        });
      });
    return () => {
      isActive = false;
    };
  }, [searchQuery, searchRetryToken]);

  const retrySearch = () => {
    if (!searchQuery) return;
    setSearchRetryToken((prev) => prev + 1);
  };

  useEffect(() => {
    writeStoredValue(viewModeKey, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStoredValue(zoomLevelKey, zoomLevel);
  }, [zoomLevel]);

  const filteredEntries = (() => {
    const entries = searchQuery
      ? searchResults
      : (directory ? directory.entries : []);

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
  })();

  return {
    directory,
    currentPath,
    lastGoodPath,
    selected,
    setSelected,
    pendingSelection,
    status,
    tree,
    treeStatus,
    searchQuery,
    submitSearch,
    clearSearch,
    searchResults,
    searchStatus,
    retrySearch,
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
    collapseAll,
    retryTree
  };
};
