import '../../styles/components/media-list.css';
import { buildThumbUrl } from '../../lib/api.js';
import { formatSize } from '../../lib/format.js';
import { iconForEntry } from './Icons.jsx';

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
      loading="lazy"
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
  selectedPath
}) => {
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
            const hasPreview = entry.type === 'image' || entry.type === 'video';
            return (
              <button
                type="button"
                key={entry.path}
                className={`grid-card ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelect(entry)}
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
          const hasPreview = entry.type === 'image' || entry.type === 'video';
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
                  {hasPreview && renderThumbStack({
                    entry,
                    sizes: LIST_THUMB_SIZES,
                    wrapperClassName: 'list-thumb-stack',
                    imgClassName: 'list-thumb',
                    iconClassName: 'list-thumb-icon',
                    iconTag: 'span'
                  })}
                  {!hasPreview && iconForEntry(entry)}
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
