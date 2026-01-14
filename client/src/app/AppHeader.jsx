import { useEffect, useRef, useState } from 'react';
import { ViewToggle } from './components/index.js';

const AppHeader = ({
  onNavigateRoot,
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
      <button
        type="button"
        className="brand"
        onClick={onNavigateRoot}
        aria-label="Go to archive root"
      >
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 1000 1000" role="img" aria-hidden="true">
            <path
              fill="rgba(0,0,0,.9)"
              d="M135 255s3 64 199 259l-65 141 173-50 92 241 100-254h232s-93-122-306-173c-213-50-329-81-425-164"
            />
          </svg>
        </span>
        <div>
          <div className="brand-title">
            <p>The Mirror's Edge <b>Archive</b></p>
            <span className="brand-subtitle">STAGING</span>
          </div>
        </div>
      </button>
      <div className={`topbar-controls ${isSearchOpen ? 'search-active' : 'search-collapsed'}`}>
        <div className="search">
          <button type="button" className="search-toggle" onClick={handleSearchOpen}>
            <span className="search-icon" aria-hidden="true">
              <i className="bi bi-search icon" aria-hidden="true" />
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
