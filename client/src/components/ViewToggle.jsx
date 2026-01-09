import React from 'react';

const ViewToggle = ({ viewMode, onChange, zoomLevel, onZoomChange }) => (
  <div className={`view-toggle ${viewMode === 'grid' ? 'show-zoom' : ''}`}>
    <div className="view-segment">
      <button
        type="button"
        className={viewMode === 'grid' ? 'active' : ''}
        onClick={() => onChange('grid')}
      >
        Grid
      </button>
      <button
        type="button"
        className={viewMode === 'list' ? 'active' : ''}
        onClick={() => onChange('list')}
      >
        List
      </button>
    </div>
    <div className="zoom-segment" aria-hidden={viewMode !== 'grid'}>
      <button
        type="button"
        className={zoomLevel === 'lg' ? 'active' : ''}
        onClick={() => onZoomChange('lg')}
        aria-label="Large thumbnails"
      >
        L
      </button>
      <button
        type="button"
        className={zoomLevel === 'md' ? 'active' : ''}
        onClick={() => onZoomChange('md')}
        aria-label="Medium thumbnails"
      >
        M
      </button>
      <button
        type="button"
        className={zoomLevel === 'sm' ? 'active' : ''}
        onClick={() => onZoomChange('sm')}
        aria-label="Small thumbnails"
      >
        S
      </button>
    </div>
  </div>
);

export default ViewToggle;
