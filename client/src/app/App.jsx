import React, { useEffect, useMemo, useRef, useState } from 'react';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import FileList from '../components/FileList.jsx';
import SortButtons from '../components/SortButtons.jsx';
import TreePanel from '../components/TreePanel.jsx';
import ViewToggle from '../components/ViewToggle.jsx';
import { API_BASE, buildFileUrl } from '../lib/api.js';
import { formatSize, getBasename } from '../lib/format.js';
import { isViewableEntry } from '../lib/fileTypes.js';
import { iconForEntry } from '../components/Icons.jsx';
import { buildStats } from '../lib/stats.js';
import { readUrlState, setUrlState } from '../lib/urlState.js';

export default function App() {
  const [directory, setDirectory] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [selected, setSelected] = useState(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaMeta, setMediaMeta] = useState({ width: null, height: null, duration: null });
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

  const hydrateTreeForPath = async (pathValue, options = {}) => {
    const { skipLast = false } = options;
    if (!pathValue) return;
    const segments = pathValue.split('/').filter(Boolean);
    const paths = [''];
    let current = '';
    segments.forEach((segment) => {
      current = current ? `${current}/${segment}` : segment;
      paths.push(current);
    });
    const finalPaths = skipLast ? paths.slice(0, -1) : paths;
    for (const treePath of finalPaths) {
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

  const didInitRef = useRef(false);

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const applyUrlState = () => {
      const urlState = readUrlState();
      const derivedPath = urlState.path;
      void hydrateTreeForPath(derivedPath, { skipLast: true });
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
    setSortDir('asc');
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
    setMediaMeta({ width: null, height: null, duration: null });
    setUrlState(
      { path: currentPath, item: '' },
      { replace: true }
    );
  };

  const openLightboxByIndex = (index) => {
    if (index < 0 || index >= viewableEntries.length) return;
    const entry = viewableEntries[index];
    if (!entry) return;
    setSelected(entry);
    setLightboxOpen(true);
    if (entry.type === 'image' || entry.type === 'video') {
      setMediaLoading(true);
    } else {
      setMediaLoading(false);
    }
    setUrlState(
      { path: currentPath, item: entry.name },
      { replace: true }
    );
  };

  const handlePrev = () => {
    openLightboxByIndex(activeLightboxIndex - 1);
  };

  const handleNext = () => {
    openLightboxByIndex(activeLightboxIndex + 1);
  };

  const rootLabel = directory?.root?.name || 'Archive';
  const selectedEntry = selected && directory?.entries.find((entry) => entry.path === selected.path)
    ? selected
    : null;
  const viewableEntries = useMemo(() => {
    if (!directory) return [];
    return directory.entries.filter((entry) => isViewableEntry(entry));
  }, [directory]);
  const activeLightboxIndex = useMemo(() => {
    if (!selectedEntry) return -1;
    return viewableEntries.findIndex((entry) => entry.path === selectedEntry.path);
  }, [viewableEntries, selectedEntry]);
  const shouldShowDimensions = selectedEntry?.type === 'image' || selectedEntry?.type === 'video';
  const hasDimensions = Number.isFinite(mediaMeta.width) && Number.isFinite(mediaMeta.height);
  const placeholderDimensions = '-- × --';

  const formatDuration = (value) => {
    if (!Number.isFinite(value) || value <= 0) return '';
    const total = Math.floor(value);
    const seconds = total % 60;
    const minutes = Math.floor(total / 60) % 60;
    const hours = Math.floor(total / 3600);
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

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
    setMediaMeta({ width: null, height: null, duration: null });
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
      if (event.key === 'ArrowLeft') {
        handlePrev();
      }
      if (event.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, selectedEntry, currentPath, activeLightboxIndex, viewableEntries]);

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
              />
            )}
          </div>
        </div>
      </main>

      {lightboxOpen && isViewableEntry(selectedEntry) && (
        <div className="lightbox" role="dialog" aria-modal="true" onClick={handleCloseLightbox}>
          <div className="lightbox-stage">
            <div
              className={`lightbox-body${selectedEntry.type === 'document' ? ' is-document' : ''}`}
              onClick={(event) => event.stopPropagation()}
            >
              {(selectedEntry.type === 'image' || selectedEntry.type === 'video') && (
                <div className={`lightbox-media${mediaLoading ? ' is-loading' : ''}`}>
                  {mediaLoading && <div className="media-loader" aria-hidden="true" />}
                  {selectedEntry.type === 'image' && (
                    <img
                      src={buildFileUrl(selectedEntry.path)}
                      alt={selectedEntry.name}
                      onLoad={(event) => {
                        setMediaLoading(false);
                        const nextMeta = {
                          width: event.currentTarget.naturalWidth,
                          height: event.currentTarget.naturalHeight,
                          duration: null
                        };
                        setMediaMeta(nextMeta);
                      }}
                    />
                  )}
                  {selectedEntry.type === 'video' && (
                    <video
                      controls
                      src={buildFileUrl(selectedEntry.path)}
                      preload="metadata"
                      onLoadedMetadata={(event) => {
                        const nextMeta = {
                          width: event.currentTarget.videoWidth,
                          height: event.currentTarget.videoHeight,
                          duration: event.currentTarget.duration
                        };
                        setMediaMeta(nextMeta);
                      }}
                      onLoadedData={() => setMediaLoading(false)}
                    />
                  )}
                </div>
              )}
              {selectedEntry.type === 'audio' && (
                <audio
                  controls
                  src={buildFileUrl(selectedEntry.path)}
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    setMediaMeta({
                      width: null,
                      height: null,
                      duration: event.currentTarget.duration
                    });
                  }}
                />
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
          <div className="lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
            <div className="lightbox-meta">
              <div className="lightbox-meta-left">
                <span className="lightbox-type-icon" aria-hidden="true">
                  {iconForEntry(selectedEntry)}
                </span>
                <div className="lightbox-meta-text">
                  <span className="lightbox-name">{selectedEntry.name}</span>
                  <div className="lightbox-meta-sub">
                    {Number.isFinite(selectedEntry.size) && selectedEntry.size > 0 && (
                      <span className="lightbox-size">{formatSize(selectedEntry.size)}</span>
                    )}
                    {shouldShowDimensions && (
                      <span
                        className={`lightbox-dimensions${hasDimensions ? '' : ' is-loading'}`}
                        aria-hidden={!hasDimensions}
                      >
                        {hasDimensions
                          ? `${mediaMeta.width} × ${mediaMeta.height}`
                          : placeholderDimensions}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="lightbox-controls">
              <div className="lightbox-nav-group" role="group" aria-label="Navigation">
                {activeLightboxIndex >= 0 && viewableEntries.length > 0 && (
                  <span className="lightbox-count">
                    {activeLightboxIndex + 1} / {viewableEntries.length}
                  </span>
                )}
                <button
                  type="button"
                  className="lightbox-nav"
                  onClick={handlePrev}
                  disabled={activeLightboxIndex <= 0}
                  aria-label="Previous item"
                >
                  ◀
                </button>
                <button
                  type="button"
                  className="lightbox-nav"
                  onClick={handleNext}
                  disabled={activeLightboxIndex >= viewableEntries.length - 1}
                  aria-label="Next item"
                >
                  ▶
                </button>
              </div>
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
        </div>
      )}
    </div>
  );
}
