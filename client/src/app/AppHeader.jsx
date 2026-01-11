import React, { useState } from 'react';
import { ViewToggle } from './components/index.js';

const AppHeader = ({
  rootLabel,
  viewMode,
  onViewModeChange,
  zoomLevel,
  onZoomChange,
  search,
  onSearchChange
}) => {
  const [isSearchActive, setIsSearchActive] = useState(false);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">⧉</span>
        <div>
          <h1>{rootLabel}</h1>
          <p>MediaView archive browser</p>
        </div>
      </div>
      <div className={`topbar-controls ${isSearchActive ? 'search-active' : ''}`}>
        <div className="search">
          <input
            type="search"
            placeholder="Search in this folder"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => setIsSearchActive(true)}
            onBlur={() => setIsSearchActive(false)}
          />
        </div>
        <ViewToggle
          viewMode={viewMode}
          onChange={onViewModeChange}
          zoomLevel={zoomLevel}
          onZoomChange={onZoomChange}
        />
      </div>
    </header>
  );
};

export default AppHeader;
