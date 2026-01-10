import React from 'react';
import { FileList, SortButtons } from './components/index.js';

const DirectoryPanel = ({
  directory,
  rootLabel,
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
  selectedPath
}) => {
  const hasError = Boolean(status.error);
  const subLabel = hasError
    ? ''
    : directory
      ? `${directory.stats.dirs} folders, ${directory.stats.files} files`
      : 'Loading...';
  return (
    <div className="panel list-panel">
      <div className="panel-header">
        <div>
          <span className="panel-title">{hasError ? '' : directory?.current?.name || rootLabel}</span>
          <span className="panel-sub">{subLabel}</span>
        </div>
        {!hasError && <SortButtons sortKey={sortKey} sortDir={sortDir} onSortClick={onSortClick} />}
      </div>
      <div className="panel-body">
        {status.loading && !status.error && <div className="state">Loading...</div>}
        {status.error && (
          <div className="state error">
            <div>{status.error}</div>
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
      </div>
    </div>
  );
};

export default DirectoryPanel;
