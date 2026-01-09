import React, { useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const formatSize = (value) => {
  if (value === null || value === undefined) return '—';
  if (value === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size < 10 && index > 0 ? 1 : 0)} ${units[index]}`;
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const getBasename = (value) => {
  if (!value) return '';
  const parts = value.split('/');
  return parts[parts.length - 1] || '';
};

const getDirname = (value) => {
  if (!value) return '';
  const parts = value.split('/');
  parts.pop();
  return parts.join('/');
};

const buildFileUrl = (pathValue) => `${API_BASE}/api/file?path=${encodeURIComponent(pathValue)}`;
const buildThumbUrl = (pathValue, size = 'sm') =>
  `${API_BASE}/api/thumbnail?path=${encodeURIComponent(pathValue)}&size=${size}`;

const VIEWABLE_TYPES = new Set(['image', 'video', 'audio', 'document', 'text']);

const isViewableEntry = (entry) => Boolean(entry && !entry.isDir && VIEWABLE_TYPES.has(entry.type));

const buildStats = (entries) =>
  entries.reduce(
    (acc, entry) => {
      if (entry.isDir) {
        acc.dirs += 1;
      } else {
        acc.files += 1;
        acc.size += entry.size || 0;
      }
      return acc;
    },
    { dirs: 0, files: 0, size: 0 }
  );

const readUrlState = () => {
  const params = new URLSearchParams(window.location.search);
  const rawPath = window.location.pathname.replace(/^\/+/, '');
  const decodedPath = rawPath
    ? rawPath
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/')
    : '';
  return {
    path: decodedPath,
    item: params.get('item') || ''
  };
};

const buildUrlState = (state) => {
  const params = new URLSearchParams();
  if (state.item) params.set('item', state.item);
  const query = params.toString();
  const pathname = state.path
    ? `/${state.path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`
    : '/';
  return `${pathname}${query ? `?${query}` : ''}`;
};

const setUrlState = (state, { replace = false } = {}) => {
  const nextUrl = buildUrlState(state);
  if (replace) {
    window.history.replaceState(null, '', nextUrl);
  } else {
    window.history.pushState(null, '', nextUrl);
  }
};

const fileTypeLabel = (entry) => {
  if (entry.isDir) return 'Folder';
  switch (entry.type) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Document';
    case 'text':
      return 'Text';
    default:
      return 'File';
  }
};

const IconFolder = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M3 6.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const IconFile = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v5h5" />
  </svg>
);

const IconImage = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 17l-5-5-4 4-2-2-5 5" />
  </svg>
);

const IconVideo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <rect x="3" y="5" width="14" height="14" rx="2" />
    <path d="M17 9l4-2v10l-4-2z" />
  </svg>
);

const IconAudio = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M9 8l6-3v14l-6-3H5V8z" />
    <path d="M19 9a4 4 0 0 1 0 6" />
  </svg>
);

const IconDoc = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

const iconForEntry = (entry) => {
  if (entry.isDir) return <IconFolder />;
  switch (entry.type) {
    case 'image':
      return <IconImage />;
    case 'video':
      return <IconVideo />;
    case 'audio':
      return <IconAudio />;
    case 'document':
    case 'text':
      return <IconDoc />;
    default:
      return <IconFile />;
  }
};

const Breadcrumbs = ({ rootLabel, path, onNavigate }) => {
  const segments = path ? path.split('/') : [];
  return (
    <div className="breadcrumbs">
      <button className="crumb" type="button" onClick={() => onNavigate('')}>
        {rootLabel}
      </button>
      {segments.map((segment, index) => {
        const crumbPath = segments.slice(0, index + 1).join('/');
        return (
          <span className="crumb-segment" key={crumbPath}>
            <span className="crumb-separator">/</span>
            <button className="crumb" type="button" onClick={() => onNavigate(crumbPath)}>
              {segment}
            </button>
          </span>
        );
      })}
    </div>
  );
};

const TreeNode = ({ node, tree, currentPath, onToggle, onNavigate }) => {
  const isLoaded = Array.isArray(node.children);
  const hasChildren = isLoaded && node.children.length > 0;
  const canExpand = !isLoaded || hasChildren;
  const isActive = node.path === currentPath;
  return (
    <div className={`tree-node ${isActive ? 'active' : ''}`}>
      <div className="tree-node-row">
        {canExpand ? (
          <button
            className={`tree-toggle ${node.expanded ? 'open' : ''}`}
            type="button"
            onClick={() => onToggle(node.path)}
            aria-label={node.expanded ? 'Collapse' : 'Expand'}
          >
            {node.expanded ? '▾' : '▸'}
          </button>
        ) : (
          <span className="tree-toggle placeholder" aria-hidden="true" />
        )}
        <button className="tree-label" type="button" onClick={() => onNavigate(node.path)}>
          <span className="tree-icon">
            <IconFolder />
          </span>
          <span>{node.name || 'Archive'}</span>
        </button>
      </div>
      {node.expanded && hasChildren && (
        <div className="tree-children">
          {node.children.map((childPath) => {
            const childNode = tree[childPath];
            if (!childNode) return null;
            return (
              <TreeNode
                key={childPath}
                node={childNode}
                tree={tree}
                currentPath={currentPath}
                onToggle={onToggle}
                onNavigate={onNavigate}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const TreePanel = ({ tree, currentPath, rootPath, onToggle, onNavigate }) => {
  const rootNode = tree[rootPath];
  if (!rootNode) return null;
  return (
    <div className="panel tree-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">Archive</span>
          <span className="panel-sub">Browse folders</span>
        </div>
      </div>
      <div className="panel-body tree-scroll">
        <TreeNode
          node={rootNode}
          tree={tree}
          currentPath={currentPath}
          onToggle={onToggle}
          onNavigate={onNavigate}
        />
      </div>
    </div>
  );
};

const FileList = ({
  entries,
  viewMode,
  onSelect,
  selectedPath,
  zoomLevel,
  sortKey,
  sortDir,
  onSortClick
}) => {
  if (viewMode === 'grid') {
    const thumbSize = zoomLevel || 'md';
    return (
      <div className="grid">
        {entries.map((entry, index) => {
          const isSelected = entry.path === selectedPath;
          return (
            <button
              type="button"
              key={entry.path}
              className={`grid-card ${isSelected ? 'selected' : ''} ${entry.isDir ? 'is-dir' : ''}`}
              onClick={() => onSelect(entry)}
              style={{ '--index': index }}
            >
              <div className="thumb">
                {entry.type === 'image' && (
                  <img
                    src={buildThumbUrl(entry.path, thumbSize)}
                    alt={entry.name}
                    loading="lazy"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallback) return;
                      event.currentTarget.dataset.fallback = 'true';
                      event.currentTarget.src = buildFileUrl(entry.path);
                    }}
                  />
                )}
                {entry.type === 'video' && (
                  <div className="thumb-stack">
                    <img
                      src={buildThumbUrl(entry.path, thumbSize)}
                      alt={entry.name}
                      loading="lazy"
                      onLoad={(event) => {
                        event.currentTarget.classList.add('loaded');
                      }}
                      onError={(event) => {
                        event.currentTarget.classList.add('thumb-failed');
                      }}
                    />
                    <div className="thumb-icon">{iconForEntry(entry)}</div>
                  </div>
                )}
                {entry.type !== 'image' && entry.type !== 'video' && (
                  <div className="thumb-icon">{iconForEntry(entry)}</div>
                )}
              </div>
              <div className="grid-label">
                <span>{entry.name}</span>
                <span className="grid-meta">{entry.isDir ? 'Folder' : formatSize(entry.size)}</span>
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="list">
      <div className="list-header">
        <span className="list-cell name">Name</span>
        <span className="list-cell size">Size</span>
      </div>
      <div className="list-body">
          {entries.map((entry, index) => {
            const isSelected = entry.path === selectedPath;
          return (
            <button
              type="button"
              key={entry.path}
              className={`list-row ${isSelected ? 'selected' : ''} ${entry.isDir ? 'is-dir' : ''}`}
              onClick={() => onSelect(entry)}
              style={{ '--index': index }}
            >
              <span className="list-cell name">
                <span className="list-icon">
                  {entry.type === 'image' && (
                    <img
                      className="list-thumb"
                      src={buildThumbUrl(entry.path, 'sm')}
                      alt={entry.name}
                      loading="lazy"
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallback) return;
                        event.currentTarget.dataset.fallback = 'true';
                        event.currentTarget.src = buildFileUrl(entry.path);
                      }}
                    />
                  )}
                  {entry.type === 'video' && (
                    <div className="list-thumb-stack">
                      <img
                        className="list-thumb"
                        src={buildThumbUrl(entry.path, 'sm')}
                        alt={entry.name}
                        loading="lazy"
                        onLoad={(event) => {
                          event.currentTarget.classList.add('loaded');
                        }}
                        onError={(event) => {
                          event.currentTarget.classList.add('thumb-failed');
                        }}
                      />
                      <span className="list-thumb-icon">{iconForEntry(entry)}</span>
                    </div>
                  )}
                  {entry.type !== 'image' && entry.type !== 'video' && iconForEntry(entry)}
                </span>
                {entry.name}
              </span>
              <span className="list-cell size">{formatSize(entry.size)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ViewToggle = ({ viewMode, onChange, zoomLevel, onZoomChange }) => (
  <div className={`view-toggle ${viewMode === 'grid' ? 'show-zoom' : ''}`}>
    <div className="view-segment">
      <button
        type="button"
        className={viewMode === 'grid' ? 'active' : ''}
        onClick={() => onChange('grid')}
      >
        Grid
      </button>
      <button
        type="button"
        className={viewMode === 'list' ? 'active' : ''}
        onClick={() => onChange('list')}
      >
        List
      </button>
    </div>
    <div className="zoom-segment" aria-hidden={viewMode !== 'grid'}>
      <button
        type="button"
        className={zoomLevel === 'lg' ? 'active' : ''}
        onClick={() => onZoomChange('lg')}
        aria-label="Large thumbnails"
      >
        L
      </button>
      <button
        type="button"
        className={zoomLevel === 'md' ? 'active' : ''}
        onClick={() => onZoomChange('md')}
        aria-label="Medium thumbnails"
      >
        M
      </button>
      <button
        type="button"
        className={zoomLevel === 'sm' ? 'active' : ''}
        onClick={() => onZoomChange('sm')}
        aria-label="Small thumbnails"
      >
        S
      </button>
    </div>
  </div>
);

const SortButtons = ({ sortKey, sortDir, onSortClick }) => (
  <div className="panel-sort">
    <button
      type="button"
      className={`panel-sort-btn ${sortKey === 'name' ? `active dir-${sortDir}` : ''}`}
      onClick={() => onSortClick('name')}
    >
      <span>Name</span>
      <span className="sort-icon" aria-hidden="true">
        ▲
      </span>
    </button>
    <button
      type="button"
      className={`panel-sort-btn ${sortKey === 'size' ? `active dir-${sortDir}` : ''}`}
      onClick={() => onSortClick('size')}
    >
      <span>Size</span>
      <span className="sort-icon" aria-hidden="true">
        ▲
      </span>
    </button>
  </div>
);

export default function App() {
  const [directory, setDirectory] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [selected, setSelected] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [textPreview, setTextPreview] = useState({
    status: 'idle',
    content: '',
    truncated: false,
    error: ''
  });
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
      throw new Error(`Failed to load ${pathValue || 'root'}`);
    }
    return response.json();
  };

  const hydrateTreeForPath = async (pathValue) => {
    if (!pathValue) return;
    const segments = pathValue.split('/').filter(Boolean);
    const paths = [''];
    let current = '';
    segments.forEach((segment) => {
      current = current ? `${current}/${segment}` : segment;
      paths.push(current);
    });
    for (const treePath of paths) {
      try {
        const data = await fetchList(treePath);
        applyListing(treePath, data, { expand: treePath === pathValue });
      } catch (error) {
        break;
      }
    }
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
      data.entries
        .filter((entry) => entry.isDir)
        .forEach((entry) => {
          const childEntries = data.children[entry.path];
          if (!childEntries) return;
          const childData = {
            root: data.root,
            current: {
              name: entry.name,
              path: entry.path,
              mtime: entry.mtime,
              mtimeMs: entry.mtimeMs
            },
            stats: buildStats(childEntries),
            entries: childEntries
          };
          cacheRef.current.set(entry.path, childData);
          updateTreeWithEntries(entry.path, childEntries, {
            expand: false,
            rootLabel: data.root?.name
          });
        });
    }
  };

  const expandAncestors = (pathValue, rootLabel) => {
    setTree((prev) => {
      const next = { ...prev };
      next[''] = { ...(next[''] || {}), path: '', name: rootLabel, expanded: true };
      if (!pathValue) return next;
      const segments = pathValue.split('/');
      let current = '';
      segments.forEach((segment) => {
        current = current ? `${current}/${segment}` : segment;
        next[current] = {
          ...(next[current] || {}),
          path: current,
          name: segment,
          expanded: true
        };
      });
      return next;
    });
  };

  const loadDirectory = async (pathValue, options = {}) => {
    const {
      selectPath = '',
      updateUrl = true,
      replaceUrl = false
    } = options;
    const cached = cacheRef.current.get(pathValue);
    if (cached) {
      const selection = selectPath
        ? cached.entries.find((entry) => entry.path === selectPath || entry.name === selectPath) ||
          null
        : null;
      const shouldLightbox = Boolean(selectPath) && isViewableEntry(selection);
      setDirectory(cached);
      setCurrentPath(pathValue);
      setSelected(selection);
      setLightboxOpen(shouldLightbox);
      expandAncestors(pathValue, cached.root?.name || 'Archive');
      setStatus({ loading: false, error: null });
      if (updateUrl) {
        setUrlState(
          {
            path: pathValue,
            item: shouldLightbox && selection ? selection.name : ''
          },
          { replace: replaceUrl }
        );
      }
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
      return;
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
      setSelected(selection);
      setLightboxOpen(shouldLightbox);
      expandAncestors(pathValue, data.root.name);
      setStatus({ loading: false, error: null });
      if (updateUrl) {
        setUrlState(
          {
            path: pathValue,
            item: shouldLightbox && selection ? selection.name : ''
          },
          { replace: replaceUrl }
        );
      }
    } catch (error) {
      setStatus({ loading: false, error: error.message });
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

  useEffect(() => {
    const applyUrlState = () => {
      const urlState = readUrlState();
      const derivedPath = urlState.path;
      void hydrateTreeForPath(derivedPath);
      loadDirectory(derivedPath, {
        selectPath: urlState.item,
        updateUrl: false
      });
    };
    applyUrlState();
    const handlePop = () => applyUrlState();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

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

  const handleOpen = (entry) => {
    if (entry.isDir) {
      loadDirectory(entry.path);
    } else if (isViewableEntry(entry)) {
      handleViewMedia(entry);
    } else {
      setSelected(entry);
      setLightboxOpen(false);
      setUrlState(
        { path: currentPath, item: '' },
        { replace: true }
      );
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
    setSortDir(key === 'size' ? 'desc' : 'asc');
  };

  const handleViewMedia = (entry) => {
    if (!isViewableEntry(entry)) return;
    if (!selected || selected.path !== entry.path) {
      setSelected(entry);
    }
    if (entry.type === 'image' || entry.type === 'video') {
      setMediaLoading(true);
    } else {
      setMediaLoading(false);
    }
    setLightboxOpen(true);
    setUrlState(
      { path: currentPath, item: entry.name },
      { replace: true }
    );
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setMediaLoading(false);
    setUrlState(
      { path: currentPath, item: '' },
      { replace: true }
    );
  };

  const rootLabel = directory?.root?.name || 'Archive';
  const selectedEntry = selected && directory?.entries.find((entry) => entry.path === selected.path)
    ? selected
    : null;

  useEffect(() => {
    if (lightboxOpen && !isViewableEntry(selectedEntry)) {
      handleCloseLightbox();
    }
  }, [lightboxOpen, selectedEntry]);

  useEffect(() => {
    if (!lightboxOpen) return;
    if (selectedEntry?.type === 'image' || selectedEntry?.type === 'video') {
      setMediaLoading(true);
    }
  }, [lightboxOpen, selectedEntry]);

  useEffect(() => {
    if (!lightboxOpen || !selectedEntry || selectedEntry.type !== 'text') {
      setTextPreview({ status: 'idle', content: '', truncated: false, error: '' });
      return undefined;
    }
    let isActive = true;
    const loadText = async () => {
      setTextPreview({ status: 'loading', content: '', truncated: false, error: '' });
      try {
        const response = await fetch(buildFileUrl(selectedEntry.path), {
          headers: { Range: 'bytes=0-65535' }
        });
        if (!response.ok) {
          throw new Error('Failed to load text preview');
        }
        const content = await response.text();
        if (!isActive) return;
        setTextPreview({
          status: 'ready',
          content,
          truncated: response.status === 206,
          error: ''
        });
      } catch (error) {
        if (!isActive) return;
        setTextPreview({
          status: 'error',
          content: '',
          truncated: false,
          error: error.message
        });
      }
    };
    loadText();
    return () => {
      isActive = false;
    };
  }, [lightboxOpen, selectedEntry]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        handleCloseLightbox();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, selectedEntry, currentPath]);

  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⧉</span>
          <div>
            <h1>{rootLabel}</h1>
            <p>MediaView archive browser</p>
          </div>
        </div>
        <div className="topbar-controls">
          <ViewToggle
            viewMode={viewMode}
            onChange={setViewMode}
            zoomLevel={zoomLevel}
            onZoomChange={setZoomLevel}
          />
          <div className="search">
            <input
              type="search"
              placeholder="Search in this folder"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="breadcrumbs-bar">
        <Breadcrumbs rootLabel={rootLabel} path={currentPath} onNavigate={loadDirectory} />
      </div>

      <main className={`layout zoom-${zoomLevel}`}>
        <TreePanel
          tree={tree}
          currentPath={currentPath}
          rootPath=""
          onToggle={handleToggle}
          onNavigate={loadDirectory}
        />

        <div className="panel list-panel">
          <div className="panel-header">
            <div>
              <span className="panel-title">{directory?.current?.name || rootLabel}</span>
              <span className="panel-sub">
                {directory
                  ? `${directory.stats.dirs} folders, ${directory.stats.files} files`
                  : 'Loading...'}
              </span>
            </div>
            <SortButtons sortKey={sortKey} sortDir={sortDir} onSortClick={handleSortClick} />
          </div>
          <div className="panel-body">
            {status.loading && <div className="state">Loading...</div>}
            {status.error && <div className="state error">{status.error}</div>}
            {!status.loading && !status.error && (
              <FileList
                entries={filteredEntries}
                viewMode={viewMode}
                onSelect={handleOpen}
                selectedPath={selectedEntry?.path}
                zoomLevel={zoomLevel}
                sortKey={sortKey}
                sortDir={sortDir}
                onSortClick={handleSortClick}
              />
            )}
          </div>
        </div>
      </main>

      {lightboxOpen && isViewableEntry(selectedEntry) && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={handleCloseLightbox}>
          <div className="lightbox-card" onClick={(event) => event.stopPropagation()}>
            <div className="lightbox-header">
              <span>{selectedEntry.name}</span>
              <div className="lightbox-actions">
                <a
                  className="lightbox-download"
                  href={buildFileUrl(selectedEntry.path)}
                  download={selectedEntry.name}
                >
                  Download
                </a>
                <button type="button" className="lightbox-close" onClick={handleCloseLightbox}>
                  Close
                </button>
              </div>
            </div>
            {(selectedEntry.type === 'image' || selectedEntry.type === 'video') && (
              <div className="lightbox-media">
                {mediaLoading && <div className="media-skeleton" aria-hidden="true" />}
                {selectedEntry.type === 'image' && (
                  <img
                    src={buildFileUrl(selectedEntry.path)}
                    alt={selectedEntry.name}
                    onLoad={() => setMediaLoading(false)}
                  />
                )}
                {selectedEntry.type === 'video' && (
                  <video
                    controls
                    src={buildFileUrl(selectedEntry.path)}
                    preload="metadata"
                    onLoadedData={() => setMediaLoading(false)}
                  />
                )}
              </div>
            )}
            {selectedEntry.type === 'audio' && (
              <audio controls src={buildFileUrl(selectedEntry.path)} preload="metadata" />
            )}
            {selectedEntry.type === 'document' && (
              <iframe
                className="lightbox-iframe"
                src={buildFileUrl(selectedEntry.path)}
                title={selectedEntry.name}
              />
            )}
            {selectedEntry.type === 'text' && (
              <div className="lightbox-text">
                {textPreview.status === 'loading' && <div>Loading preview...</div>}
                {textPreview.status === 'error' && (
                  <div className="lightbox-error">{textPreview.error}</div>
                )}
                {textPreview.status === 'ready' && (
                  <>
                    {textPreview.truncated && (
                      <div className="lightbox-note">Showing first 64 KB.</div>
                    )}
                    <pre>{textPreview.content}</pre>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
