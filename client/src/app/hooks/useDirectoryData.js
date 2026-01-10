import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../../lib/api.js';
import { getBasename } from '../../lib/format.js';
import { isViewableEntry } from '../../lib/fileTypes.js';
import { buildStats } from '../../lib/stats.js';

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
  const [tree, setTree] = useState({
    '': { path: '', name: 'Archive', expanded: true, children: null }
  });
  const cacheRef = useRef(new Map());
  const currentPathRef = useRef('');
  const lastGoodPathRef = useRef('');
  const [lastGoodPath, setLastGoodPath] = useState('');
  const resolvePathRef = useRef(0);
  const hasFetchedTreeRef = useRef(false);

  const applyTreeNodes = (nodes) => {
    if (!nodes) return;
    setTree((prev) => {
      const next = { ...prev };
      Object.values(nodes).forEach((node) => {
        if (!node) return;
        const prevNode = next[node.path];
        next[node.path] = {
          path: node.path,
          name: node.name || prevNode?.name || (node.path ? getBasename(node.path) : 'Archive'),
          children: Array.isArray(node.children) ? node.children : [],
          expanded: prevNode?.expanded ?? node.path === ''
        };
      });
      return next;
    });
  };

  const fetchTree = async () => {
    const response = await fetch(`${API_BASE}/api/tree`);
    if (!response.ok) {
      throw new Error('Failed to load tree');
    }
    return response.json();
  };

  const fetchList = async (pathValue, options = {}) => {
    const { force = false, background = false } = options;
    const cached = cacheRef.current.get(pathValue);
    if (cached && !force) {
      if (background) {
        void fetchList(pathValue, { force: true })
          .then((data) => {
            applyListing(pathValue, data, { expand: false });
            if (currentPathRef.current === pathValue) {
              setDirectory(data);
              setSelected((prev) =>
                prev && data.entries.find((entry) => entry.path === prev.path) ? prev : null
              );
            }
          })
          .catch(() => {});
      }
      return cached;
    }
    const response = await fetch(`${API_BASE}/api/list?path=${encodeURIComponent(pathValue)}`);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Requested content could not be found.');
      }
      throw new Error(`Failed to load ${pathValue || 'root'}`);
    }
    return response.json();
  };

  const updateTreeWithEntries = (pathValue, entries, options = {}) => {
    const { expand = false, rootLabel } = options;
    setTree((prev) => {
      const next = { ...prev };
      const nodeName = pathValue ? getBasename(pathValue) : rootLabel || prev['']?.name || 'Archive';
      const children = entries.filter((entry) => entry.isDir).map((entry) => entry.path);
      next[pathValue] = {
        path: pathValue,
        name: nodeName,
        expanded: expand ? true : next[pathValue]?.expanded ?? false,
        children
      };
      entries
        .filter((entry) => entry.isDir)
        .forEach((entry) => {
          if (!next[entry.path]) {
            next[entry.path] = {
              path: entry.path,
              name: entry.name,
              expanded: false,
              children: null
            };
          }
        });
      return next;
    });
  };

  const applyListing = (pathValue, data, options = {}) => {
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
  };

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

  const getLastResolvablePath = (pathValue) => {
    const chain = getPathChain(pathValue);
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const candidate = chain[index];
      if (cacheRef.current.has(candidate)) {
        return candidate;
      }
    }
    return '';
  };

  const resolveLastGoodPath = async (pathValue, requestId) => {
    const chain = getPathChain(pathValue);
    let lastSuccess = '';
    for (const chainPath of chain) {
      try {
        const data = await fetchList(chainPath);
        if (resolvePathRef.current !== requestId) return;
        applyListing(chainPath, data, { expand: true });
        lastSuccess = chainPath;
      } catch (error) {
        break;
      }
    }
    if (resolvePathRef.current !== requestId) return;
    lastGoodPathRef.current = lastSuccess;
    setLastGoodPath(lastSuccess);
  };

  const hydratePathChain = async (pathValue) => {
    if (!pathValue) return;
    const chain = getPathChain(pathValue);
    const chainToFetch = chain.slice(0, -1);
    chainToFetch.forEach((chainPath) => {
      const cached = cacheRef.current.get(chainPath);
      if (!cached) return;
      updateTreeWithEntries(chainPath, cached.entries, {
        expand: true,
        rootLabel: cached.root?.name
      });
    });
    await Promise.all(
      chainToFetch.map(async (chainPath) => {
        if (cacheRef.current.has(chainPath)) return;
        try {
          const data = await fetchList(chainPath, { background: true });
          applyListing(chainPath, data, { expand: true });
        } catch (error) {
          // ignore background failures
        }
      })
    );
  };

  const expandAncestors = (pathValue, rootLabel) => {
    setTree((prev) => {
      const next = { ...prev };
      const resolvedRootLabel = rootLabel || prev['']?.name || 'Archive';
      next[''] = { ...(next[''] || {}), path: '', name: resolvedRootLabel, expanded: true };
      if (!pathValue) return next;
      const segments = pathValue.split('/').filter(Boolean);
      let parentPath = '';
      segments.forEach((segment) => {
        const current = parentPath ? `${parentPath}/${segment}` : segment;
        const parentNode = next[parentPath] || {
          path: parentPath,
          name: parentPath ? getBasename(parentPath) : resolvedRootLabel,
          expanded: true,
          children: []
        };
        const children = Array.isArray(parentNode.children) ? [...parentNode.children] : [];
        if (!children.includes(current)) {
          children.push(current);
        }
        next[parentPath] = { ...parentNode, children, expanded: true };
        next[current] = {
          ...(next[current] || {}),
          path: current,
          name: segment,
          expanded: true
        };
        parentPath = current;
      });
      return next;
    });
  };


  const loadDirectory = async (pathValue, options = {}) => {
    const { selectPath = '' } = options;
    if (pathValue) {
      void hydratePathChain(pathValue);
    }
    const cached = cacheRef.current.get(pathValue);
    if (cached) {
      const selection = selectPath
        ? cached.entries.find((entry) => entry.path === selectPath || entry.name === selectPath) ||
          null
        : null;
      const shouldLightbox = Boolean(selectPath) && isViewableEntry(selection);
      setDirectory(cached);
      setCurrentPath(pathValue);
      if (pathValue) {
        lastGoodPathRef.current = pathValue;
        setLastGoodPath(pathValue);
      }
      setSelected(selection);
      expandAncestors(pathValue, cached.root?.name || 'Archive');
      setStatus({ loading: false, error: null });
      void fetchList(pathValue, { force: true })
        .then((data) => {
          applyListing(pathValue, data, { expand: true });
          if (currentPathRef.current === pathValue) {
            setDirectory(data);
            setSelected((prev) =>
              prev && data.entries.find((entry) => entry.path === prev.path) ? prev : null
            );
          }
        })
        .catch(() => {});
      return { selection, shouldLightbox };
    }
    setStatus({ loading: true, error: null });
    try {
      const data = await fetchList(pathValue);
      applyListing(pathValue, data, { expand: true });
      const selection = selectPath
        ? data.entries.find((entry) => entry.path === selectPath || entry.name === selectPath) ||
          null
        : null;
      const shouldLightbox = Boolean(selectPath) && isViewableEntry(selection);
      setDirectory(data);
      setCurrentPath(pathValue);
      if (pathValue) {
        lastGoodPathRef.current = pathValue;
        setLastGoodPath(pathValue);
      }
      setSelected(selection);
      expandAncestors(pathValue, data.root.name);
      setStatus({ loading: false, error: null });
      return { selection, shouldLightbox };
    } catch (error) {
      const fallbackPath = getLastResolvablePath(pathValue);
      lastGoodPathRef.current = fallbackPath;
      setLastGoodPath(fallbackPath);
      resolvePathRef.current += 1;
      const requestId = resolvePathRef.current;
      void resolveLastGoodPath(pathValue, requestId);
      setStatus({ loading: false, error: error.message });
      return { selection: null, shouldLightbox: false };
    }
  };

  const loadChildren = async (pathValue) => {
    try {
      const data = await fetchList(pathValue, { background: true });
      applyListing(pathValue, data, { expand: false });
    } catch (error) {
      setStatus({ loading: false, error: error.message });
    }
  };

  const handleToggle = (pathValue) => {
    const node = tree[pathValue];
    if (!node) return;
    if (!node.expanded && node.children === null) {
      loadChildren(pathValue);
    }
    setTree((prev) => ({
      ...prev,
      [pathValue]: {
        ...prev[pathValue],
        expanded: !prev[pathValue].expanded
      }
    }));
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
    if (hasFetchedTreeRef.current) return () => {};
    hasFetchedTreeRef.current = true;
    fetchTree()
      .then((data) => {
        if (!isActive) return;
        applyTreeNodes(data?.nodes);
      })
      .catch(() => {});
    return () => {
      isActive = false;
    };
  }, []);

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
      } else if (sortKey === 'mtime') {
        compare = a.mtimeMs - b.mtimeMs;
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
    handleToggle
  };
};
