import React, { useEffect, useRef, useState } from 'react';
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
  const inputRef = useRef(null);
  const hasSearchText = Boolean(search.trim());
  const isSearchOpen = isSearchActive || hasSearchText;

  useEffect(() => {
    if (isSearchActive) {
      inputRef.current?.focus();
    }
  }, [isSearchActive]);

  const handleSearchChange = (nextValue) => {
    onSearchChange(nextValue);
  };

  const handleSearchBlur = () => {
    if (!search.trim()) {
      setIsSearchActive(false);
    }
  };

  const handleSearchOpen = () => {
    setIsSearchActive(true);
  };

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">⧉</span>
        <div>
          <h1>{rootLabel}</h1>
          <p>MediaView archive browser</p>
        </div>
      </div>
      <div className={`topbar-controls ${isSearchOpen ? 'search-active' : 'search-collapsed'}`}>
        <div className="search">
          <button type="button" className="search-toggle" onClick={handleSearchOpen}>
            <span className="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="icon">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <span className="search-label-full">Search in this folder</span>
            <span className="search-label-short">Search</span>
          </button>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search in this folder"
            value={search}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={() => setIsSearchActive(true)}
            onBlur={handleSearchBlur}
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
