import React from 'react';
import './ViewToggle.css';

const ViewToggle = ({ viewMode, onChange, zoomLevel, onZoomChange }) => (
  <div className={`view-toggle ${viewMode === 'grid' ? 'show-zoom' : ''}`}>
    <div className="view-segment">
      <div className={`view-mode grid-mode ${viewMode === 'grid' ? 'active' : ''}`}>
        <button
          type="button"
          className={`mode-button ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onChange('grid')}
        >
          Grid
        </button>
        <div className="zoom-segment" role="group" aria-label="Grid size">
          <button
            type="button"
            className={zoomLevel === 'sm' ? 'active' : ''}
            onClick={() => onZoomChange('sm')}
            aria-label="Small thumbnails"
            disabled={viewMode !== 'grid'}
          >
            S
          </button>
          <button
            type="button"
            className={zoomLevel === 'md' ? 'active' : ''}
            onClick={() => onZoomChange('md')}
            aria-label="Medium thumbnails"
            disabled={viewMode !== 'grid'}
          >
            M
          </button>
          <button
            type="button"
            className={zoomLevel === 'lg' ? 'active' : ''}
            onClick={() => onZoomChange('lg')}
            aria-label="Large thumbnails"
            disabled={viewMode !== 'grid'}
          >
            L
          </button>
        </div>
      </div>
      <button
        type="button"
        className={`view-mode list-mode ${viewMode === 'list' ? 'active' : ''}`}
        onClick={() => onChange('list')}
      >
        List
      </button>
    </div>
  </div>
);

export default ViewToggle;
