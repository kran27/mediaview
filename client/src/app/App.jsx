import { useEffect, useRef, useState } from 'react';
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
import { setUrlState } from '../lib/urlState.js';
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
  const searchHeaderRef = useRef(null);
  const loadDirectoryRef = useRef(loadDirectory);
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
    searchStateRef.current.searchQuery = searchQuery;
  }, [searchQuery]);

  const handleClearSearch = () => {
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
      handleClearSearch();
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

  const handleHighlight = (entry) => {
    setSelected(entry);
  };

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
    handleClearSearch();
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
    clearSearch: handleClearSearch,
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
            handleClearSearch();
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
      />

      {isTreeHidden && (
        <div className="breadcrumbs-bar tree-hidden">
          <Breadcrumbs
            rootLabel={rootLabel}
            path={status.error ? lastGoodPath : currentPath}
            onNavigate={handleNavigate}
            searchQuery={searchQuery}
          />
        </div>
      )}

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
            hideHeader={false}
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
          onHighlight={handleHighlight}
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
