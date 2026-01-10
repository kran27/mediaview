import React from 'react';
import { ViewToggle } from './components/index.js';

const AppHeader = ({ rootLabel, viewMode, onViewModeChange, zoomLevel, onZoomChange, search, onSearchChange }) => (
  <header className="topbar">
    <div className="brand">
      <span className="brand-mark">⧉</span>
      <div>
        <h1>{rootLabel}</h1>
        <p>MediaView archive browser</p>
      </div>
    </div>
    <div className="topbar-controls">
      <ViewToggle
        viewMode={viewMode}
        onChange={onViewModeChange}
        zoomLevel={zoomLevel}
        onZoomChange={onZoomChange}
      />
      <div className="search">
        <input
          type="search"
          placeholder="Search in this folder"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </div>
  </header>
);

export default AppHeader;
