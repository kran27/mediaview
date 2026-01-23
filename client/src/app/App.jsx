import { useEffect, useRef, useState } from 'react';
import '../styles/components/animations.css';
import '../styles/components/context-menu.css';
import '../styles/components/footer.css';
import '../styles/components/header.css';
import '../styles/components/icons.css';
import '../styles/components/layout.css';
import '../styles/components/lightbox.css';
import '../styles/components/media-list.css';
import '../styles/components/navigation.css';
import '../styles/components/panel.css';
import '../styles/components/toolbar.css';
import '../styles/components/TreePanel.css';
import '../styles/components/ViewToggle.css';
import {
  AppFooter,
  AppHeader,
  Breadcrumbs,
  ConnectionLightbox,
  DirectoryPanel,
  Lightbox,
  TreePanel
} from './components/index.js';
import { getBasename } from '../lib/format.js';
import { setUrlState } from '../lib/urlState.js';
import { useDirectoryData } from './hooks/useDirectoryData.js';
import { useBatchDownload } from './hooks/useBatchDownload.js';
import { useLightboxState } from './hooks/useLightboxState.js';
import { useMediaQuery } from './hooks/useMediaQuery.js';
import { useUrlSync } from './hooks/useUrlSync.js';

export default function App() {
  const {
    directory,
    currentPath,
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
    loadDirectory,
    handleToggle,
    collapseAll,
    expandToCurrentPath,
    lastGoodPath,
    retryTree
  } = useDirectoryData();
  const {
    selectionMode,
    selectedPaths,
    selectedCount,
    setSelectionMode,
    toggleSelection,
    setSelectionEntries,
    clearSelection,
    discoverSelection,
    downloadSelection,
    cancelDownload,
    resetDownloadState,
    downloadState
  } = useBatchDownload();
  const [contextMenu, setContextMenu] = useState({
    open: false,
    x: 0,
    y: 0,
    entry: null,
    type: 'entry'
  });
  const [downloadPrompt, setDownloadPrompt] = useState({
    open: false,
    summary: null
  });
  const [lastBrowsePath, setLastBrowsePath] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const searchHeaderRef = useRef(null);
  const layoutRef = useRef(null);
  const loadDirectoryRef = useRef(loadDirectory);
  const isSearchMode = Boolean(searchQuery);
  const searchStateRef = useRef({ searchQuery: '', searchInput: '' });

  const rootLabel = 'Archive';
  const currentPathName = currentPath ? getBasename(currentPath) : rootLabel;
  const pendingSelectionPath = pendingSelection || '';
  const activeEntries = searchQuery
    ? searchResults
    : (directory?.entries || []);
  const isTreeHidden = useMediaQuery('(max-width: 1100px)');

  useEffect(() => {
    loadDirectoryRef.current = loadDirectory;
  }, [loadDirectory]);

  useEffect(() => {
    searchStateRef.current.searchQuery = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    const layoutEl = layoutRef.current;
    if (!layoutEl) return undefined;
    if (!isTreeHidden && footerOpen) {
      layoutEl.setAttribute('data-footer-overlay', 'true');
    } else {
      layoutEl.removeAttribute('data-footer-overlay');
    }
    return undefined;
  }, [footerOpen, isTreeHidden]);

  const handleFooterOverlayClick = () => {
    setFooterOpen(false);
  };

  const clearSearchState = () => {
    searchHeaderRef.current?.setSearchValue('');
    searchHeaderRef.current?.setSearchFocused(false);
    searchStateRef.current.searchInput = '';
    clearSearch();
  };

  const handleSearchValueChange = (value) => {
    searchStateRef.current.searchInput = value;
  };

  const setSearchInputValue = (value) => {
    searchHeaderRef.current?.setSearchValue(value);
    searchStateRef.current.searchInput = value;
  };

  const hasSearchState = () => {
    const inputValue = searchStateRef.current.searchInput;
    return Boolean(searchQuery || inputValue.trim());
  };


  const navigateTo = async (pathValue, options = {}) => {
    const {
      selectPath = '',
      updateUrl = true,
      replaceUrl = false,
      openLightbox = true
    } = options;
    const { selection, shouldLightbox } = await loadDirectoryRef.current(pathValue, {
      selectPath,
      openLightbox
    });
    setLightboxOpen(shouldLightbox);
    if (updateUrl) {
      setUrlState(
        {
          path: pathValue,
          preview: shouldLightbox && selection ? selection.name : ''
        },
        { replace: replaceUrl }
      );
    }
  };

  const handleNavigate = (pathValue, options = {}) => {
    if (hasSearchState()) {
      clearSearchState();
    }
    return navigateTo(pathValue, options);
  };

  const {
    selectedEntry,
    lightboxEntries,
    activeLightboxIndex,
    handleOpen,
    handleClose,
    handlePrev,
    handleNext,
    handleNavigateFromLightbox
  } = useLightboxState({
    entries: activeEntries,
    currentPath,
    isSearchMode,
    selected,
    setSelected,
    onNavigate: handleNavigate,
    lightboxOpen,
    setLightboxOpen
  });

  const closeContextMenu = () => {
    setContextMenu((prev) => ({ ...prev, open: false, entry: null }));
  };

  const openContextMenu = (entry, position, menuType = 'entry') => {
    if (!entry && menuType !== 'selection') return;
    const menuWidth = 200;
    const menuHeight = menuType === 'selection' ? 64 : 120;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const x = Math.min(position.x, Math.max(0, viewportWidth - menuWidth));
    const y = Math.min(position.y, Math.max(0, viewportHeight - menuHeight));
    setContextMenu({
      open: true,
      x,
      y,
      entry: menuType === 'selection' ? null : entry,
      type: menuType
    });
  };

  const handleContextSelect = () => {
    if (!contextMenu.entry) return;
    setSelectionMode(true);
    setSelectionEntries([contextMenu.entry]);
    closeContextMenu();
  };

  const handleContextDownload = async () => {
    if (!contextMenu.entry) return;
    setSelectionMode(true);
    setSelectionEntries([contextMenu.entry]);
    closeContextMenu();
    const summary = await discoverSelection([contextMenu.entry]);
    if (summary) {
      setDownloadPrompt({ open: true, summary });
    }
  };

  const handleContextCancelSelection = () => {
    setSelectionMode(false);
    closeContextMenu();
  };

  const handleContextGoToEntry = () => {
    if (!contextMenu.entry) return;
    closeContextMenu();
    void handleNavigateFromLightbox(contextMenu.entry);
  };

  const handleRequestDownload = async () => {
    const summary = await discoverSelection();
    if (summary) {
      setDownloadPrompt({ open: true, summary });
    }
  };

  const handleConfirmDownload = () => {
    if (!downloadPrompt.summary) return;
    downloadSelection(null, downloadPrompt.summary);
    setDownloadPrompt({ open: false, summary: null });
  };

  const handleCancelDownloadPrompt = () => {
    setDownloadPrompt({ open: false, summary: null });
  };

  useEffect(() => {
    if (!contextMenu.open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        closeContextMenu();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu.open]);

  useEffect(() => {
    if (selectionMode) {
      setSelected(null);
    }
  }, [selectionMode, setSelected]);

  const applySearch = (value) => {
    const trimmed = value.trim();
    if (trimmed) {
      const fallbackPath = currentPath ?? lastGoodPath ?? '';
      setLastBrowsePath(fallbackPath || '');
    }
    submitSearch(trimmed);
    return trimmed;
  };

  const handleSearchSubmit = (value) => {
    const trimmed = applySearch(value);
    if (trimmed) {
      setUrlState({ search: trimmed });
    } else {
      setUrlState({ path: currentPath, preview: '' });
    }
  };


  const handleCloseSearch = () => {
    const returnPath = lastBrowsePath ?? '';
    clearSearchState();
    void navigateTo(returnPath);
  };

  const handleRetryList = () => {
    void loadDirectory(currentPath, { force: true });
  };

  const handleRetryConnection = () => {
    retryTree?.();
    void loadDirectory(currentPath, { force: true });
  };
  const showConnectionLightbox = (
    ((status.error && status.retryable) || (treeStatus.error && treeStatus.retryable))
    && !status.loading
    && !treeStatus.loading
  );

  useUrlSync({
    clearSearch: clearSearchState,
    setSearchInput: setSearchInputValue,
    applySearch,
    navigateTo,
    setLightboxOpen,
    searchStateRef
  });

  return (
    <div className="page">
      <AppHeader
        rootLabel={rootLabel}
        onNavigateRoot={() => {
          if (hasSearchState()) {
            clearSearchState();
          }
          void navigateTo('');
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        searchQuery={searchQuery}
        ref={searchHeaderRef}
        onSearchValueChange={handleSearchValueChange}
        onSearchSubmit={handleSearchSubmit}
        onSearchClear={handleCloseSearch}
        onToggleFooter={() => setFooterOpen((prev) => !prev)}
        showFooterToggle={!isTreeHidden}
        footerOpen={footerOpen}
      />

      <div className="breadcrumbs-bar">
        <Breadcrumbs
          rootLabel={rootLabel}
          path={status.error ? lastGoodPath : currentPath}
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
          isPathStale={Boolean(status.error)}
        />
      </div>

      <main className={`layout zoom-${zoomLevel}`} ref={layoutRef}>
        <TreePanel
          tree={tree}
          currentPath={searchQuery ? null : currentPath}
          rootPath=""
          rootLabel={rootLabel}
          onToggle={handleToggle}
          onCollapseAll={collapseAll}
          onExpandCurrent={expandToCurrentPath}
          onNavigate={handleNavigate}
          hideHeader={false}
          status={treeStatus}
          onRetry={retryTree}
        />

        <DirectoryPanel
          directory={directory}
          rootLabel={rootLabel}
          currentPath={currentPath}
          currentPathName={currentPathName}
          status={status}
          lastGoodPath={lastGoodPath}
          onNavigate={handleNavigate}
          entries={activeEntries}
          viewMode={viewMode}
          zoomLevel={zoomLevel}
          useWindowScroll={isTreeHidden}
          onSelect={handleOpen}
          selectedPath={selectionMode ? '' : (selected?.path || pendingSelectionPath)}
          selectionMode={selectionMode}
          selectedPaths={selectedPaths}
          selectedCount={selectedCount}
          onToggleSelection={toggleSelection}
          onClearSelection={clearSelection}
          onRequestDownload={handleRequestDownload}
          onConfirmDownload={handleConfirmDownload}
          onCancelDownloadPrompt={handleCancelDownloadPrompt}
          onCancelDownload={cancelDownload}
          onResetDownloadState={resetDownloadState}
          onSetSelectionMode={setSelectionMode}
          downloadState={downloadState}
          downloadPrompt={downloadPrompt}
          contextMenu={contextMenu}
          onOpenContextMenu={openContextMenu}
          onCloseContextMenu={closeContextMenu}
          onContextSelect={handleContextSelect}
          onContextDownload={handleContextDownload}
          onContextCancelSelection={handleContextCancelSelection}
          onContextGoToEntry={handleContextGoToEntry}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchStatus={searchStatus}
          onRetrySearch={retrySearch}
          onClearSearch={handleCloseSearch}
          onRetryList={handleRetryList}
        />
        <div
          className="footer-scroll-guard"
          aria-hidden="true"
          onClick={handleFooterOverlayClick}
        />
      </main>

      {isTreeHidden ? (
        <AppFooter />
      ) : (
        <div className={`footer-drawer${footerOpen ? ' is-open' : ''}`} aria-hidden={!footerOpen}>
          <AppFooter />
        </div>
      )}

      <ConnectionLightbox
        open={showConnectionLightbox}
        onRetry={handleRetryConnection}
        rootLabel={rootLabel}
      />

      <Lightbox
        open={lightboxOpen}
        selectedEntry={selectedEntry}
        lightboxEntries={lightboxEntries}
        activeIndex={activeLightboxIndex}
        onClose={handleClose}
        onPrev={handlePrev}
        onNext={handleNext}
        showPath
        onNavigatePath={handleNavigateFromLightbox}
      />
    </div>
  );
}
