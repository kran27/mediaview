import { useEffect } from 'react';
import { readUrlState } from '../../lib/urlState.js';

export const useUrlSync = ({
  clearSearch,
  setSearchInput,
  applySearch,
  navigateTo,
  setLightboxOpen,
  searchStateRef
}) => {
  useEffect(() => {
    const applyUrlState = () => {
      const urlState = readUrlState();
      if (urlState.search) {
        setSearchInput(urlState.search);
        applySearch(urlState.search);
        setLightboxOpen(false);
        return;
      }
      const { searchQuery: currentQuery, searchInput: currentInput } = searchStateRef.current;
      if (currentQuery || currentInput.trim()) {
        clearSearch();
      }
      const derivedPath = urlState.path;
      void navigateTo(derivedPath, { selectPath: urlState.preview, updateUrl: false });
    };
    applyUrlState();
    const handlePop = () => applyUrlState();
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [applySearch, clearSearch, navigateTo, searchStateRef, setLightboxOpen, setSearchInput]);
};
