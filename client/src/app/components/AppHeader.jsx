import { useEffect, useRef, useState } from 'react';
import { ViewToggle } from './index.js';

const AppHeader = ({
  onNavigateRoot,
  viewMode,
  onViewModeChange,
  zoomLevel,
  onZoomChange,
  searchValue,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onSearchClear
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const inputRef = useRef(null);
  const hasSearchText = Boolean(searchValue.trim() || searchQuery);
  const isSearchOpen = isSearchFocused || hasSearchText;
  const showStaging = import.meta.env.VITE_SHOW_STAGING !== 'false';

  useEffect(() => {
    if (isSearchFocused) {
      inputRef.current?.focus();
    }
  }, [isSearchFocused]);

  useEffect(() => {
    if (!hasSearchText && inputRef.current && document.activeElement !== inputRef.current) {
      setIsSearchFocused(false);
    }
  }, [hasSearchText]);

  const handleSearchBlur = () => {
    if (!searchValue.trim() && !searchQuery) {
      setIsSearchFocused(false);
    }
  };

  const handleSearchOpen = () => {
    setIsSearchFocused(true);
    inputRef.current?.focus();
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    onSearchSubmit(searchValue);
    if (searchValue.trim()) {
      setIsSearchFocused(true);
    }
  };

  const handleSearchClear = () => {
    onSearchClear?.();
    inputRef.current?.focus();
    if (!searchValue.trim() && !searchQuery) {
      setIsSearchFocused(false);
    }
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
              className="brand-mark-path"
              d="M135 255s3 64 199 259l-65 141 173-50 92 241 100-254h232s-93-122-306-173c-213-50-329-81-425-164"
            />
          </svg>
        </span>
        <div>
          <div className="brand-title">
            <p>The Mirror&apos;s Edge <b>Archive</b></p>
            {showStaging && <span className="brand-subtitle">STAGING</span>}
          </div>
        </div>
      </button>
      <div className={`topbar-controls ${isSearchOpen ? 'search-active' : 'search-collapsed'}`}>
        <form className="search" onSubmit={handleSearchSubmit}>
          <button type="button" className="search-toggle" onClick={handleSearchOpen}>
            <span className="search-icon" aria-hidden="true">
              <i className="bi bi-search icon" aria-hidden="true" />
            </span>
            <span className="search-label-full">Search the archive</span>
            <span className="search-label-short">Search</span>
          </button>
          <span className="search-icon desktop" aria-hidden="true">
            <i className="bi bi-search icon" aria-hidden="true" />
          </span>
          <input
            ref={inputRef}
            type="search"
            placeholder="Search the archive"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={handleSearchBlur}
          />
          <button
            type="button"
            className={`search-clear${hasSearchText ? '' : ' is-hidden'}`}
            onClick={handleSearchClear}
            aria-label="Close search results"
            title="Close search results"
          >
            <i className="bi bi-x-lg icon" aria-hidden="true" />
          </button>
        </form>
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
