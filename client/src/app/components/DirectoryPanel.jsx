import { useRef } from 'react';
import { formatSize } from '../../lib/format.js';
import {
  FileList,
  IconCheck2Square,
  IconCheckCircleFill,
  IconClose,
  IconDownload,
  SortButtons
} from './index.js';

const DownloadConfirmModal = ({ summary, onCancel, onConfirm }) => {
  const warning = summary?.writerMode === 'memory'
    ? 'This download may not finish in your browser. If it stalls, try a smaller selection or another browser.'
    : '';

  return (
    <>
      <button
        type="button"
        className="download-modal-backdrop"
        onClick={onCancel}
        aria-label="Close download confirmation"
      />
      <div
        className="download-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-modal-title"
      >
        <div className="download-modal-header">
          <div className="download-modal-title" id="download-modal-title">
            Confirm download
          </div>
          <div className="download-modal-sub">
            Review the selection before downloading.
          </div>
        </div>
        <div className="download-modal-body">
          <div className="download-modal-row">
            <span>Files</span>
            <strong>{summary.totalFiles}</strong>
          </div>
          <div className="download-modal-row">
            <span>Total size</span>
            <strong>{formatSize(summary.totalBytes)}</strong>
          </div>
          {warning && (
            <div className="download-modal-warning">{warning}</div>
          )}
        </div>
        <div className="download-modal-actions">
          <button
            type="button"
            className="download-modal-btn is-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="download-modal-btn"
            onClick={onConfirm}
          >
            Download
          </button>
        </div>
      </div>
    </>
  );
};

const DownloadProgressModal = ({
  state,
  progressValue,
  progressMax,
  onCancel,
  onDismiss
}) => (
  <>
    <button
      type="button"
      className="download-progress-backdrop"
      onClick={state.status === 'listing'
        || state.status === 'downloading'
        || state.status === 'finalizing'
        ? onCancel
        : onDismiss}
      aria-label={state.status === 'listing'
        || state.status === 'downloading'
        || state.status === 'finalizing'
        ? 'Cancel download'
        : 'Close download status'}
    />
    <div
      className="download-progress-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-progress-title"
    >
      <div className="download-progress-header">
        <div className="download-progress-title" id="download-progress-title">
          {state.status === 'listing' && 'Preparing download'}
          {state.status === 'downloading' && 'Downloading selection'}
          {state.status === 'finalizing' && 'Finalizing archive'}
          {state.status === 'warning' && 'Download finished with warnings'}
          {state.status === 'done' && 'Download complete'}
          {state.status === 'error' && 'Download failed'}
          {state.status === 'cancelled' && 'Download cancelled'}
        </div>
        <div className="download-progress-sub">
          {(state.status === 'listing'
            || state.status === 'downloading'
            || state.status === 'finalizing')
            ? 'Keep this window open while we prepare your archive.'
            : 'You can close this window when you are ready.'}
        </div>
      </div>
      <div className="download-progress-body">
        {state.status === 'listing' && (
          <div className="download-progress-meta">
            <span>{state.processedDirs} folders scanned</span>
            <span>{state.queuedDirs} pending</span>
          </div>
        )}
        {state.status === 'downloading' && (
          <>
            <div className="download-progress-meta">
              <span>
                {state.processedFiles} / {state.totalFiles} files
              </span>
              {state.totalBytes > 0 && (
                <span>
                  {formatSize(state.processedBytes)} / {formatSize(state.totalBytes)}
                </span>
              )}
            </div>
            <progress value={progressValue} max={progressMax} />
            {state.currentFile && (
              <div className="download-progress-file">{state.currentFile}</div>
            )}
          </>
        )}
        {state.status === 'finalizing' && (
          <div className="download-progress-meta">
            Finishing up your download...
          </div>
        )}
        {(state.status === 'warning'
          || state.status === 'done'
          || state.status === 'error'
          || state.status === 'cancelled') && (
          <div className="download-progress-meta">
            {state.status === 'warning' && 'We finished the download, but some items may be missing.'}
            {state.status === 'done' && 'Your download is ready.'}
            {state.status === 'error' && 'Something went wrong while preparing the download.'}
            {state.status === 'cancelled' && 'The download was cancelled.'}
          </div>
        )}
        {state.warning && state.status !== 'done' && (
          <div className="download-modal-warning">{state.warning}</div>
        )}
        {state.error && (
          <div className="download-modal-warning">{state.error}</div>
        )}
      </div>
      <div className="download-progress-actions">
        {(state.status === 'listing'
          || state.status === 'downloading'
          || state.status === 'finalizing') ? (
          <button type="button" className="download-modal-btn is-secondary" onClick={onCancel}>
            Cancel download
          </button>
        ) : (
          <button type="button" className="download-modal-btn" onClick={onDismiss}>
            Close
          </button>
        )}
      </div>
    </div>
  </>
);

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
  selectionMode,
  selectedPaths,
  selectedCount,
  onToggleSelection,
  onRequestDownload,
  onConfirmDownload,
  onCancelDownloadPrompt,
  onCancelDownload,
  onSetSelectionMode,
  onResetDownloadState,
  downloadState,
  downloadPrompt,
  contextMenu,
  onOpenContextMenu,
  onCloseContextMenu,
  onContextSelect,
  onContextDownload,
  onContextCancelSelection,
  searchQuery,
  searchResults,
  searchStatus,
  onRetrySearch,
  onRetryList
}) => {
  const panelRef = useRef(null);
  const hasError = Boolean(status.error);
  const isNotFound = status?.code === 404;
  const isSearchActive = Boolean(searchQuery);
  const searchCount = searchResults?.length || 0;
  const searchLoading = isSearchActive && searchStatus?.loading;
  const searchError = isSearchActive && searchStatus?.error;
  const isRoot = !currentPath;
  const hasSelection = selectedCount > 0;
  const isDownloading = downloadState?.status === 'listing'
    || downloadState?.status === 'downloading'
    || downloadState?.status === 'finalizing';
  const hasDownloadStatus = downloadState?.status && downloadState.status !== 'idle';
  const progressMax = downloadState?.totalBytes || downloadState?.totalFiles || 1;
  const progressValue = downloadState?.totalBytes
    ? downloadState?.processedBytes
    : downloadState?.processedFiles;
  const downloadSummary = downloadPrompt?.summary;
  const showProgressModal = hasDownloadStatus;
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
    <div
      ref={panelRef}
      className={`panel list-panel${selectionMode ? ' selection-active' : ''}`}
    >
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
        {contextMenu?.open && (
          <>
            <button
              type="button"
              className="context-menu-backdrop"
              onClick={onCloseContextMenu}
              aria-label="Close menu"
            />
            <div
              className="context-menu"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              role="menu"
            >
              {contextMenu.type === 'selection' ? (
                <button type="button" className="context-menu-item" onClick={onContextCancelSelection}>
                  <span className="context-menu-icon" aria-hidden="true">
                    <IconClose />
                  </span>
                  Cancel selection
                </button>
              ) : (
                <>
                  <button type="button" className="context-menu-item" onClick={onContextSelect}>
                    <span className="context-menu-icon" aria-hidden="true">
                      <IconCheckCircleFill />
                    </span>
                    Select
                  </button>
                  <button type="button" className="context-menu-item" onClick={onContextDownload}>
                    <span className="context-menu-icon" aria-hidden="true">
                      <IconDownload />
                    </span>
                    Download
                  </button>
                </>
              )}
            </div>
          </>
        )}
        {downloadPrompt?.open && downloadSummary && (
          <DownloadConfirmModal
            summary={downloadSummary}
            onCancel={onCancelDownloadPrompt}
            onConfirm={onConfirmDownload}
          />
        )}
        {showProgressModal && (
          <DownloadProgressModal
            state={downloadState}
            progressValue={progressValue}
            progressMax={progressMax}
            onCancel={onCancelDownload}
            onDismiss={() => {
              onSetSelectionMode(false);
              onResetDownloadState();
            }}
          />
        )}
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
                selectionMode={selectionMode}
                selectedPaths={selectedPaths}
                onToggleSelection={onToggleSelection}
                onOpenContextMenu={onOpenContextMenu}
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
                selectionMode={selectionMode}
                selectedPaths={selectedPaths}
                onToggleSelection={onToggleSelection}
                onOpenContextMenu={onOpenContextMenu}
                zoomLevel={zoomLevel}
              />
            )}
          </>
        )}
      </div>
      {selectionMode && (
        <div
          className="selection-bar"
          role="region"
          aria-label="Selection mode"
        >
          <div className="selection-bar-info">
            <span className="selection-bar-icon" aria-hidden="true">
              <IconCheck2Square />
            </span>
            <div className="selection-bar-title">Selection mode</div>
          </div>
          <div className="selection-bar-actions">
            <button
              type="button"
              className="panel-action-btn"
              onClick={onRequestDownload}
              disabled={!hasSelection || isDownloading}
            >
              {isDownloading ? 'Downloading...' : `Download${hasSelection ? ` (${selectedCount})` : ''}`}
            </button>
            <button
              type="button"
              className="panel-action-btn"
              onClick={() => onSetSelectionMode(false)}
              disabled={isDownloading}
            >
              Cancel selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectoryPanel;
