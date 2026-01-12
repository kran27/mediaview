import '../../styles/components/media-list.css';
import { buildThumbUrl } from '../../lib/api.js';
import { formatSize } from '../../lib/format.js';
import { iconForEntry } from './Icons.jsx';

const FileList = ({
  entries,
  viewMode,
  onSelect,
  selectedPath,
  zoomLevel
}) => {
  if (viewMode === 'grid') {
    const thumbSize = zoomLevel || 'md';
    const folders = entries.filter((entry) => entry.isDir);
    const files = entries.filter((entry) => !entry.isDir);
    return (
      <div className="grid-sections">
        {folders.length > 0 && (
          <div className="grid grid-folders">
            {folders.map((entry, index) => {
              const isSelected = entry.path === selectedPath;
              return (
                <button
                  type="button"
                  key={entry.path}
                  className={`grid-card grid-folder-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => onSelect(entry)}
                  style={{ '--index': index }}
                >
                  <div className="grid-folder-thumb">
                    <div className="thumb-icon">{iconForEntry(entry)}</div>
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
            return (
              <button
                type="button"
                key={entry.path}
                className={`grid-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(entry)}
                style={{ '--index': index }}
              >
                <div className="thumb">
                  {entry.type === 'image' && (
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

export default FileList;
