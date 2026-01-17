import { useState } from 'react';
import { isViewableEntry } from '../../lib/fileTypes.js';
import { getDirname } from '../../lib/format.js';
import { setUrlState } from '../../lib/urlState.js';

export const useLightboxState = ({
  entries,
  currentPath,
  isSearchMode,
  selected,
  setSelected,
  onNavigate,
  lightboxOpen: externalOpen,
  setLightboxOpen: externalSetOpen
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const lightboxOpen = externalOpen ?? internalOpen;
  const setLightboxOpen = externalSetOpen ?? setInternalOpen;

  const selectedEntry = selected && entries.find((entry) => entry.path === selected.path)
    ? selected
    : null;
  const lightboxEntries = entries.filter((entry) => !entry.isDir);
  const activeLightboxIndex = selectedEntry
    ? lightboxEntries.findIndex((entry) => entry.path === selectedEntry.path)
    : -1;

  const handleViewMedia = (entry) => {
    if (!isViewableEntry(entry)) return;
    if (!selected || selected.path !== entry.path) {
      setSelected(entry);
    }
    setLightboxOpen(true);
    if (!isSearchMode) {
      setUrlState({ path: currentPath, preview: entry.name }, { replace: true });
    }
  };

  const handleOpen = (entry) => {
    if (entry.isDir) {
      void onNavigate(entry.path);
      return;
    }
    if (isViewableEntry(entry)) {
      handleViewMedia(entry);
      return;
    }
    setSelected(entry);
    setLightboxOpen(true);
    if (!isSearchMode) {
      setUrlState({ path: currentPath, preview: entry.name }, { replace: true });
    }
  };

  const handleClose = () => {
    setLightboxOpen(false);
    if (!isSearchMode) {
      setUrlState({ path: currentPath, preview: '' }, { replace: true });
    }
  };

  const openLightboxByIndex = (index) => {
    if (index < 0 || index >= lightboxEntries.length) return;
    const entry = lightboxEntries[index];
    if (!entry) return;
    setSelected(entry);
    setLightboxOpen(true);
    if (!isSearchMode) {
      setUrlState({ path: currentPath, preview: entry.name }, { replace: true });
    }
  };

  const handlePrev = () => {
    openLightboxByIndex(activeLightboxIndex - 1);
  };

  const handleNext = () => {
    openLightboxByIndex(activeLightboxIndex + 1);
  };

  const handleNavigateFromLightbox = (entry) => {
    if (!entry?.path) {
      setLightboxOpen(false);
      return Promise.resolve();
    }
    const targetDir = getDirname(entry.path);
    setLightboxOpen(false);
    return onNavigate(targetDir, { selectPath: entry.path, openLightbox: false });
  };

  return {
    lightboxOpen,
    setLightboxOpen,
    selectedEntry,
    lightboxEntries,
    activeLightboxIndex,
    handleOpen,
    handleViewMedia,
    handleClose,
    handlePrev,
    handleNext,
    handleNavigateFromLightbox,
  };
};
