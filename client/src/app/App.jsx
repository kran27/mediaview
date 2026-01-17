import { useCallback, useEffect, useRef, useState } from 'react';
import '../styles/components/layout.css';
import '../styles/components/lightbox.css';
import '../styles/components/navigation.css';
import '../styles/components/header.css';
import '../styles/components/footer.css';
import '../styles/components/animations.css';
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
import { readUrlState, setUrlState } from '../lib/urlState.js';
import { useDirectoryData } from './hooks/useDirectoryData.js';
import { useLightboxState } from './hooks/useLightboxState.js';
import { useResponsiveTree } from './hooks/useResponsiveTree.js';
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
    searchInput,
    setSearchInput,
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
    lastGoodPath,
    retryTree
  } = useDirectoryData();
  const [lastBrowsePath, setLastBrowsePath] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const loadDirectoryRef = useRef(loadDirectory);
  const hasSearchState = Boolean(searchQuery || searchInput.trim());
  const isSearchMode = Boolean(searchQuery);
  const searchStateRef = useRef({ searchQuery: '', searchInput: '' });

  const rootLabel = 'Archive root';
  const currentPathName = currentPath ? getBasename(currentPath) : rootLabel;
  const pendingSelectionPath = pendingSelection || '';
  const activeEntries = filteredEntries;
  const isTreeHidden = useResponsiveTree(1100);

  useEffect(() => {
    loadDirectoryRef.current = loadDirectory;
  }, [loadDirectory]);

  useEffect(() => {
    searchStateRef.current = { searchQuery, searchInput };
  }, [searchQuery, searchInput]);

  useEffect(() => {
    if (!searchQuery) return;
    const urlState = readUrlState();
    if (!urlState.search) {
      clearSearch();
    }
  }, [clearSearch, searchQuery]);

  const navigateTo = useCallback(async (pathValue, options = {}) => {
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
  }, [setLightboxOpen]);

  const handleNavigate = useCallback((pathValue, options = {}) => {
    if (hasSearchState) {
      clearSearch();
    }
    return navigateTo(pathValue, options);
  }, [clearSearch, hasSearchState, navigateTo]);

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

  const applySearch = useCallback((value) => {
    const trimmed = value.trim();
    if (trimmed) {
      const fallbackPath = currentPath ?? lastGoodPath ?? '';
      setLastBrowsePath(fallbackPath || '');
    }
    submitSearch(trimmed);
    return trimmed;
  }, [currentPath, lastGoodPath, submitSearch]);

  const handleSearchSubmit = useCallback((value) => {
    const trimmed = applySearch(value);
    if (trimmed) {
      setUrlState({ search: trimmed });
    } else {
      setUrlState({ path: currentPath, preview: '' });
    }
  }, [applySearch, currentPath]);


  const handleCloseSearch = useCallback(() => {
    const returnPath = lastBrowsePath ?? '';
    clearSearch();
    void navigateTo(returnPath);
  }, [clearSearch, navigateTo, lastBrowsePath]);

  const handleRetryList = useCallback(() => {
    void loadDirectory(currentPath, { force: true });
  }, [currentPath, loadDirectory]);

  const handleRetryConnection = useCallback(() => {
    retryTree?.();
    void loadDirectory(currentPath, { force: true });
  }, [currentPath, loadDirectory, retryTree]);
  const showConnectionLightbox = (status.error || treeStatus.error)
    && !status.loading
    && !treeStatus.loading;

  useUrlSync({
    clearSearch,
    setSearchInput,
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
          if (hasSearchState) {
            clearSearch();
          }
          void navigateTo('');
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        zoomLevel={zoomLevel}
        onZoomChange={setZoomLevel}
        searchValue={searchInput}
        searchQuery={searchQuery}
        onSearchChange={setSearchInput}
        onSearchSubmit={handleSearchSubmit}
        onSearchClear={handleCloseSearch}
      />

      <div className={`breadcrumbs-bar${isTreeHidden ? ' tree-hidden' : ''}`}>
        <Breadcrumbs
          rootLabel={rootLabel}
          path={status.error ? lastGoodPath : currentPath}
          onNavigate={handleNavigate}
          searchQuery={searchQuery}
        />
      </div>

      <main className={`layout zoom-${zoomLevel}`}>
        {!isTreeHidden && (
          <TreePanel
            tree={tree}
            currentPath={searchQuery ? null : currentPath}
            rootPath=""
            rootLabel={rootLabel}
            onToggle={handleToggle}
            onCollapseAll={collapseAll}
            onNavigate={handleNavigate}
            hideHeader={Boolean(status.error)}
            status={treeStatus}
            onRetry={retryTree}
          />
        )}

        <DirectoryPanel
          directory={directory}
          rootLabel={rootLabel}
          currentPath={currentPath}
          currentPathName={currentPathName}
          status={status}
          lastGoodPath={lastGoodPath}
          onNavigate={handleNavigate}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortClick={handleSortClick}
          entries={filteredEntries}
          viewMode={viewMode}
          zoomLevel={zoomLevel}
          onSelect={handleOpen}
          selectedPath={selected?.path || pendingSelectionPath}
          searchQuery={searchQuery}
          searchResults={searchResults}
          searchStatus={searchStatus}
          onRetrySearch={retrySearch}
          onRetryList={handleRetryList}
        />
      </main>

      <AppFooter />

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
