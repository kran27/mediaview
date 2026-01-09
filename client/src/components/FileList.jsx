import React from 'react';
import { buildFileUrl, buildThumbUrl } from '../lib/api.js';
import { formatSize } from '../lib/format.js';
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
    return (
      <div className="grid">
        {entries.map((entry, index) => {
          const isSelected = entry.path === selectedPath;
          return (
            <button
              type="button"
              key={entry.path}
              className={`grid-card ${isSelected ? 'selected' : ''} ${entry.isDir ? 'is-dir' : ''}`}
              onClick={() => onSelect(entry)}
              style={{ '--index': index }}
            >
              <div className="thumb">
                {entry.type === 'image' && (
                  <img
                    src={buildThumbUrl(entry.path, thumbSize)}
                    alt={entry.name}
                    loading="lazy"
                    onError={(event) => {
                      if (event.currentTarget.dataset.fallback) return;
                      event.currentTarget.dataset.fallback = 'true';
                      event.currentTarget.src = buildFileUrl(entry.path);
                    }}
                  />
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
                <span className="grid-meta">{entry.isDir ? 'Folder' : formatSize(entry.size)}</span>
              </div>
            </button>
          );
        })}
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
                    <img
                      className="list-thumb"
                      src={buildThumbUrl(entry.path, 'sm')}
                      alt={entry.name}
                      loading="lazy"
                      onError={(event) => {
                        if (event.currentTarget.dataset.fallback) return;
                        event.currentTarget.dataset.fallback = 'true';
                        event.currentTarget.src = buildFileUrl(entry.path);
                      }}
                    />
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
