import { useEffect, useRef } from 'react';
import { buildThumbUrl } from '../../lib/api.js';
import { formatSize } from '../../lib/format.js';
import { IconCheckCircleFill, iconForEntry } from './index.js';

const LIST_THUMB_SIZES = '32px';
const THUMB_WIDTHS = { sm: 200, md: 400, lg: 600 };

const handleThumbLoad = (event) => {
  event.currentTarget.classList.add('loaded');
};

const handleThumbError = (event) => {
  event.currentTarget.classList.add('thumb-failed');
};

const buildThumbSrcSet = (pathValue) => ([
  `${buildThumbUrl(pathValue, 'sm')} ${THUMB_WIDTHS.sm}w`,
  `${buildThumbUrl(pathValue, 'md')} ${THUMB_WIDTHS.md}w`,
  `${buildThumbUrl(pathValue, 'lg')} ${THUMB_WIDTHS.lg}w`
].join(', '));

const renderThumbStack = ({
  entry,
  sizes,
  wrapperClassName,
  imgClassName,
  iconClassName,
  iconTag: IconTag
}) => (
  <div className={wrapperClassName}>
    <img
      className={imgClassName}
      src={buildThumbUrl(entry.path, 'sm')}
      srcSet={buildThumbSrcSet(entry.path)}
      sizes={sizes}
      onLoad={handleThumbLoad}
      onError={handleThumbError}
    />
    <IconTag className={iconClassName}>{iconForEntry(entry)}</IconTag>
  </div>
);

const FileList = ({
  entries,
  viewMode,
  onSelect,
  selectedPath,
  selectionMode,
  selectedPaths,
  onToggleSelection,
  onOpenContextMenu
}) => {
  const containerRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const longPressFiredRef = useRef(false);

  const handleActivate = (entry) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(entry);
      return;
    }
    onSelect(entry);
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const openContextMenuAt = (entry, position) => {
    if (!onOpenContextMenu) return;
    if (selectionMode) {
      onOpenContextMenu(null, position, 'selection');
      return;
    }
    onOpenContextMenu(entry, position, 'entry');
  };

  const handlePointerDown = (entry, event) => {
    if (!onOpenContextMenu) return;
    if (event.pointerType === 'mouse') return;
    clearLongPress();
    longPressFiredRef.current = false;
    const { clientX, clientY } = event;
    longPressTimerRef.current = setTimeout(() => {
      openContextMenuAt(entry, { x: clientX, y: clientY });
      longPressFiredRef.current = true;
      clearLongPress();
    }, 500);
  };

  const handlePointerUp = () => {
    clearLongPress();
  };

  const handleContextMenu = (entry, event) => {
    if (!onOpenContextMenu) return;
    event.preventDefault();
    openContextMenuAt(entry, { x: event.clientX, y: event.clientY });
  };

  const handleClick = (entry) => {
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    handleActivate(entry);
  };

  useEffect(() => {
    if (!selectedPath) return;
    const root = containerRef.current;
    if (!root) return;
    const nodes = root.querySelectorAll('[data-path]');
    let target = null;
    nodes.forEach((node) => {
      if (node.dataset.path === selectedPath) {
        target = node;
      }
    });
    if (!target) return;
    const frameId = requestAnimationFrame(() => {
      target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
    return () => cancelAnimationFrame(frameId);
  }, [entries, selectedPath, viewMode]);

  if (viewMode === 'grid') {
    const folders = [];
    const files = [];

    entries.forEach((entry) => {
      if (entry.isDir) {
        folders.push(entry);
      } else {
        files.push(entry);
      }
    });

    return (
      <div className="grid-sections" ref={containerRef}>
        {folders.length > 0 && (
          <div className="grid grid-folders">
            {folders.map((entry, index) => {
              const isSelected = entry.path === selectedPath;
              const isBatchSelected = selectedPaths?.has(entry.path);
              return (
                <button
                  type="button"
                  key={entry.path}
                  data-path={entry.path}
                  className={`grid-card grid-folder-card ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''}`}
                  onClick={() => handleClick(entry)}
                  onPointerDown={(event) => handlePointerDown(entry, event)}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onContextMenu={(event) => handleContextMenu(entry, event)}
                  aria-pressed={selectionMode ? isBatchSelected : undefined}
                  style={{ '--index': index }}
                >
                  <div className="grid-folder-thumb">
                    <div className="thumb-icon">{iconForEntry(entry)}</div>
                    {isBatchSelected && (
                      <div className="selection-overlay" aria-hidden="true">
                        <span className="selection-icon">
                          <IconCheckCircleFill />
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="grid-folder-label">
                    <span>{entry.name}</span>
                    <span className="grid-meta">Folder</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-files">
          {files.map((entry, index) => {
            const isSelected = entry.path === selectedPath;
            const isBatchSelected = selectedPaths?.has(entry.path);
            const hasPreview = entry.type === 'image' || entry.type === 'video';
            return (
              <button
                type="button"
                key={entry.path}
                data-path={entry.path}
                className={`grid-card ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''}`}
                onClick={() => handleClick(entry)}
                onPointerDown={(event) => handlePointerDown(entry, event)}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onContextMenu={(event) => handleContextMenu(entry, event)}
                aria-pressed={selectionMode ? isBatchSelected : undefined}
                style={{ '--index': index }}
              >
                <div className="thumb">
                  {hasPreview && renderThumbStack({
                    entry,
                    sizes: 'auto',
                    wrapperClassName: 'thumb-stack',
                    imgClassName: undefined,
                    iconClassName: 'thumb-icon',
                    iconTag: 'div'
                  })}
                  {!hasPreview && (
                    <div className="thumb-icon">{iconForEntry(entry)}</div>
                  )}
                  {isBatchSelected && (
                    <div className="selection-overlay" aria-hidden="true">
                      <span className="selection-icon">
                        <IconCheckCircleFill />
                      </span>
                    </div>
                  )}
                </div>
                <div className="grid-label">
                  <span>{entry.name}</span>
                  <span className="grid-meta">{formatSize(entry.size)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="list">
      <div className="list-header">
        <span className="list-cell name">Name</span>
        <span className="list-cell size">Size</span>
      </div>
      <div className="list-body" ref={containerRef}>
        {entries.map((entry, index) => {
          const isSelected = entry.path === selectedPath;
          const isBatchSelected = selectedPaths?.has(entry.path);
          const hasPreview = entry.type === 'image' || entry.type === 'video';
          return (
            <button
              type="button"
              key={entry.path}
              data-path={entry.path}
              className={`list-row ${isSelected ? 'selected' : ''} ${isBatchSelected ? 'is-selected' : ''} ${entry.isDir ? 'is-dir' : ''}`}
              onClick={() => handleClick(entry)}
              onPointerDown={(event) => handlePointerDown(entry, event)}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onContextMenu={(event) => handleContextMenu(entry, event)}
              aria-pressed={selectionMode ? isBatchSelected : undefined}
              style={{ '--index': index }}
            >
              <span className="list-cell name">
                <span className="list-icon">
                  {hasPreview && renderThumbStack({
                    entry,
                    sizes: LIST_THUMB_SIZES,
                    wrapperClassName: 'list-thumb-stack',
                    imgClassName: 'list-thumb',
                    iconClassName: 'list-thumb-icon',
                    iconTag: 'span'
                  })}
                  {!hasPreview && iconForEntry(entry)}
                  {isBatchSelected && (
                    <span className="selection-overlay" aria-hidden="true">
                      <span className="selection-icon">
                        <IconCheckCircleFill />
                      </span>
                    </span>
                  )}
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

export default FileList;
