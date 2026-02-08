import { useEffect, useRef } from 'react';
import { setUrlState } from '../../lib/urlState.js';
import { useUrlSync } from './useUrlSync.js';

const setMetaTagContent = (attributeName, attributeValue, content) => {
  if (!content) return;
  const selector = `meta[${attributeName}="${attributeValue}"]`;
  let metaTag = document.head?.querySelector(selector);
  if (!metaTag) {
    metaTag = document.createElement('meta');
    metaTag.setAttribute(attributeName, attributeValue);
    document.head?.appendChild(metaTag);
  }
  metaTag.setAttribute('content', content);
};

const useAppRouting = ({
  baseTitle,
  currentPath,
  currentPathName,
  searchQuery,
  searchHeaderRef,
  clearSearch,
  submitSearch,
  navigateTo,
  setLightboxOpen,
  lastBrowsePath,
  setLastBrowsePath
}) => {
  const searchStateRef = useRef({ searchQuery: '', searchInput: '' });

  useEffect(() => {
    searchStateRef.current.searchQuery = searchQuery;
  }, [searchQuery]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const pageTitle = searchQuery
      ? `${baseTitle} - Search for "${searchQuery}"`
      : (!currentPath ? baseTitle : `${baseTitle} - ${currentPathName}`);
    const description = baseTitle;
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}`;
    const image = `${origin}/icon-192.png`;

    document.title = pageTitle;
    setMetaTagContent('property', 'og:title', pageTitle);
    setMetaTagContent('property', 'og:description', description);
    setMetaTagContent('property', 'og:image', image);
    setMetaTagContent('property', 'og:url', url);
    setMetaTagContent('name', 'twitter:title', pageTitle);
    setMetaTagContent('name', 'twitter:description', description);
    setMetaTagContent('name', 'twitter:image', image);
  }, [baseTitle, currentPath, currentPathName, searchQuery]);

  const clearSearchState = () => {
    searchHeaderRef.current?.setSearchValue('');
    searchHeaderRef.current?.setSearchFocused(false);
    searchStateRef.current.searchInput = '';
    clearSearch();
  };

  const handleSearchValueChange = (value) => {
    searchStateRef.current.searchInput = value;
  };

  const setSearchInputValue = (value) => {
    searchHeaderRef.current?.setSearchValue(value);
    searchStateRef.current.searchInput = value;
  };

  const hasSearchState = () => {
    const inputValue = searchStateRef.current.searchInput;
    return Boolean(searchQuery || inputValue.trim());
  };

  const applySearch = (value) => {
    const trimmed = value.trim();
    if (trimmed) {
      const fallbackPath = currentPath ?? lastBrowsePath ?? '';
      setLastBrowsePath(fallbackPath || '');
    }
    submitSearch(trimmed);
    return trimmed;
  };

  const handleSearchSubmit = (value) => {
    const trimmed = applySearch(value);
    if (trimmed) {
      setUrlState({ search: trimmed });
    } else {
      setUrlState({ path: currentPath, preview: '' });
    }
  };

  const handleCloseSearch = () => {
    const returnPath = lastBrowsePath ?? '';
    clearSearchState();
    void navigateTo(returnPath);
  };

  useUrlSync({
    clearSearch: clearSearchState,
    setSearchInput: setSearchInputValue,
    applySearch,
    navigateTo,
    setLightboxOpen,
    searchStateRef
  });

  return {
    searchStateRef,
    clearSearchState,
    handleSearchValueChange,
    setSearchInputValue,
    hasSearchState,
    handleSearchSubmit,
    handleCloseSearch
  };
};

export { useAppRouting };
