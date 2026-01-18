import { FileList, SortButtons } from './index.js';

const DirectoryPanel = ({
  directory,
  rootLabel,
  currentPath,
  currentPathName,
  status,
  lastGoodPath,
  onNavigate,
  sortKey,
  sortDir,
  onSortClick,
  entries,
  viewMode,
  zoomLevel,
  onSelect,
  selectedPath,
  searchQuery,
  searchResults,
  searchStatus,
  onRetrySearch,
  onRetryList
}) => {
  const hasError = Boolean(status.error);
  const isNotFound = status?.code === 404;
  const isSearchActive = Boolean(searchQuery);
  const searchCount = searchResults?.length || 0;
  const searchLoading = isSearchActive && searchStatus?.loading;
  const searchError = isSearchActive && searchStatus?.error;
  const isRoot = !currentPath;
  const titleText = isSearchActive
    ? 'Search results'
    : isNotFound
      ? 'Not found'
      : (hasError ? '' : (isRoot ? rootLabel : (directory?.current?.name || currentPathName || rootLabel)));
  const searchResultLabel = `${searchCount} result${searchCount === 1 ? '' : 's'} for "${searchQuery}"`;
  const subLabel = isSearchActive
    ? (
      searchLoading
        ? `Searching "${searchQuery}"...`
        : searchError
          ? 'Search failed'
          : `${searchResultLabel}${searchStatus?.truncated ? ` (showing first ${searchCount})` : ''}`
    )
    : (hasError
      ? ''
      : directory
        ? `${directory.stats.dirs} folders, ${directory.stats.files} files`
        : 'Loading...');
  return (
    <div className="panel list-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">{titleText}</span>
          <span className="panel-sub">{subLabel}</span>
        </div>
        <div className="panel-actions">
          {!hasError && <SortButtons sortKey={sortKey} sortDir={sortDir} onSortClick={onSortClick} />}
        </div>
      </div>
      <div className="panel-body">
        {isSearchActive ? (
          <>
            {searchLoading && <div className="state">Searching...</div>}
            {searchError && (
              <div className="state error">
                <div>{searchStatus.error}</div>
                {searchStatus.retryable && onRetrySearch && (
                  <button type="button" className="state-cta" onClick={onRetrySearch}>
                    Retry search
                  </button>
                )}
              </div>
            )}
            {!searchLoading && !searchError && searchCount === 0 && (
              <div className="state">No results found.</div>
            )}
            {!searchLoading && !searchError && searchCount > 0 && (
              <FileList
                entries={entries}
                viewMode={viewMode}
                onSelect={onSelect}
                selectedPath={selectedPath}
                zoomLevel={zoomLevel}
              />
            )}
          </>
        ) : (
          <>
            {status.loading && !status.error && <div className="state">Loading...</div>}
            {status.error && (
              <div className="state error">
                <div>{status.error}</div>
                <div className="state-actions">
                  {status.retryable && onRetryList && (
                    <button type="button" className="state-cta" onClick={onRetryList}>
                      Retry
                    </button>
                  )}
                  {lastGoodPath !== null && lastGoodPath !== undefined && (
                    <button
                      type="button"
                      className="state-cta"
                      onClick={() => onNavigate(lastGoodPath)}
                    >
                      View {lastGoodPath ? lastGoodPath : rootLabel}
                    </button>
                  )}
                </div>
              </div>
            )}
            {!status.loading && !status.error && (
              <FileList
                entries={entries}
                viewMode={viewMode}
                onSelect={onSelect}
                selectedPath={selectedPath}
                zoomLevel={zoomLevel}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DirectoryPanel;
