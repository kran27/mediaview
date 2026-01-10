import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../styles/components/layout.css';
import '../styles/components/lightbox.css';
import '../styles/components/navigation.css';
import '../styles/components/header.css';
import '../styles/components/animations.css';
import { Breadcrumbs, TreePanel } from './components/index.js';
import { isViewableEntry } from '../lib/fileTypes.js';
import { getBasename } from '../lib/format.js';
import { readUrlState, setUrlState } from '../lib/urlState.js';
import { useDirectoryData } from './hooks/useDirectoryData.js';
import AppHeader from './AppHeader.jsx';
import DirectoryPanel from './DirectoryPanel.jsx';
import Lightbox from './Lightbox.jsx';

export default function App() {
  const {
    directory,
    currentPath,
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
    lastGoodPath
  } = useDirectoryData();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const didInitRef = useRef(false);

  const rootLabel = directory?.root?.name || 'Archive';
  const currentPathName = currentPath ? getBasename(currentPath) : rootLabel;
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

  const navigateTo = async (pathValue, options = {}) => {
    const { selectPath = '', updateUrl = true, replaceUrl = false } = options;
    const { selection, shouldLightbox } = await loadDirectory(pathValue, { selectPath });
    setLightboxOpen(shouldLightbox);
    if (updateUrl) {
      setUrlState(
        {
          path: pathValue,
          item: shouldLightbox && selection ? selection.name : ''
        },
        { replace: replaceUrl }
      );
    }
  };

  const handleOpen = (entry) => {
    if (entry.isDir) {
      void navigateTo(entry.path);
    } else if (isViewableEntry(entry)) {
      handleViewMedia(entry);
    } else {
      setSelected(entry);
      setLightboxOpen(true);
      setUrlState(
        { path: currentPath, item: entry.name },
        { replace: true }
      );
    }
  };

  const handleViewMedia = (entry) => {
    if (!isViewableEntry(entry)) return;
    if (!selected || selected.path !== entry.path) {
      setSelected(entry);
    }
    setLightboxOpen(true);
    setUrlState(
      { path: currentPath, item: entry.name },
      { replace: true }
    );
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
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

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    const applyUrlState = () => {
      const urlState = readUrlState();
      const derivedPath = urlState.path;
      void navigateTo(derivedPath, { selectPath: urlState.item, updateUrl: false });
    };
    applyUrlState();
    const handlePop = () => applyUrlState();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  return (
    <div className="page">
      <AppHeader
        rootLabel={rootLabel}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        search={search}
        onSearchChange={setSearch}
      />

      <div className="breadcrumbs-bar">
        <Breadcrumbs
          rootLabel={rootLabel}
          path={status.error ? lastGoodPath : currentPath}
          onNavigate={navigateTo}
        />
      </div>

      <main className={`layout zoom-${zoomLevel}`}>
        <TreePanel
          tree={tree}
          currentPath={currentPath}
          rootPath=""
          onToggle={handleToggle}
          onNavigate={navigateTo}
          hideHeader={Boolean(status.error)}
        />

      <DirectoryPanel
        directory={directory}
        rootLabel={rootLabel}
        currentPathName={currentPathName}
        status={status}
        lastGoodPath={lastGoodPath}
        onNavigate={navigateTo}
        sortKey={sortKey}
        sortDir={sortDir}
        onSortClick={handleSortClick}
          entries={filteredEntries}
          viewMode={viewMode}
          zoomLevel={zoomLevel}
          onSelect={handleOpen}
          selectedPath={selectedEntry?.path}
        />
      </main>

      <Lightbox
        open={lightboxOpen}
        selectedEntry={selectedEntry}
        viewableEntries={viewableEntries}
        activeIndex={activeLightboxIndex}
        onClose={handleCloseLightbox}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  );
}
