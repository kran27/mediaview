import { useCallback, useMemo, useRef, useState } from 'react';
import { fileSave, supported as fileSystemSupported } from 'browser-fs-access';
import { Zip, ZipPassThrough } from 'fflate';
import { buildFileUrl, fetchList } from '../../lib/api.js';
const PROGRESS_UPDATE_MS = 200;
const INITIAL_DOWNLOAD_STATE = {
  status: 'idle',
  processedFiles: 0,
  totalFiles: 0,
  processedBytes: 0,
  totalBytes: 0,
  processedDirs: 0,
  queuedDirs: 0,
  currentFile: '',
  error: '',
  warning: ''
};

const canUseFileSystemAccess = () => Boolean(fileSystemSupported);

const createZipWriter = async (filename, mode) => {
  if (mode === 'fileSystem') {
    const handle = await window.showSaveFilePicker({
      suggestedName: filename,
      types: [{ description: 'Zip archive', accept: { 'application/zip': ['.zip'] } }]
    });
    const writable = await handle.createWritable();
    return {
      type: 'fileSystem',
      write: (chunk) => writable.write(chunk),
      close: () => writable.close(),
      abort: (reason) => writable.abort(reason)
    };
  }

  const chunks = [];
  return {
    type: 'memory',
    write: (chunk) => {
      chunks.push(chunk);
    },
    close: async () => {
      const blob = new Blob(chunks, { type: 'application/zip' });
      await fileSave(blob, { fileName: filename, extensions: ['.zip'] });
    },
    abort: async () => {
      chunks.length = 0;
    }
  };
};

export const useBatchDownload = () => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState(() => new Map());
  const [downloadState, setDownloadState] = useState(INITIAL_DOWNLOAD_STATE);
  const abortRef = useRef(null);
  const progressRef = useRef({ bytes: 0, lastUpdate: 0 });

  const selectedCount = selectedEntries.size;
  const selectedPaths = useMemo(() => new Set(selectedEntries.keys()), [selectedEntries]);

  const normalizeEntry = useCallback((entry) => ({
    path: entry.path,
    name: entry.name,
    isDir: Boolean(entry.isDir),
    size: Number.isFinite(entry.size) ? entry.size : null
  }), []);

  const setSelectionModeSafe = useCallback((nextMode) => {
    setSelectionMode(nextMode);
    if (!nextMode) {
      setSelectedEntries(new Map());
    }
  }, [normalizeEntry]);

  const toggleSelectionMode = useCallback(() => {
    setSelectionModeSafe(!selectionMode);
  }, [selectionMode, setSelectionModeSafe]);

  const toggleSelection = useCallback((entry) => {
    if (!entry?.path) return;
    setSelectedEntries((prev) => {
      const next = new Map(prev);
      if (next.has(entry.path)) {
        next.delete(entry.path);
      } else {
        next.set(entry.path, normalizeEntry(entry));
      }
      return next;
    });
  }, [normalizeEntry]);

  const setSelectionEntries = useCallback((entries) => {
    const next = new Map();
    entries.forEach((entry) => {
      if (!entry?.path) return;
      next.set(entry.path, normalizeEntry(entry));
    });
    setSelectedEntries(next);
  }, [normalizeEntry]);

  const clearSelection = useCallback(() => {
    setSelectedEntries(new Map());
  }, []);

  const resetDownloadState = useCallback(() => {
    setDownloadState(INITIAL_DOWNLOAD_STATE);
  }, []);

  const cancelDownload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const getWriterMode = useCallback(() => (
    canUseFileSystemAccess() ? 'fileSystem' : 'memory'
  ), []);

  const getWriterWarning = useCallback((writerMode) => (
    writerMode === 'memory'
      ? 'This download may not finish in your browser. If it stalls, try a smaller selection or another browser.'
      : ''
  ), []);

  const expandSelection = useCallback(async (entries, signal) => {
    const files = [];
    const queue = [];
    const visited = new Set();
    let totalBytes = 0;

    entries.forEach((entry) => {
      if (!entry?.path) return;
      if (entry.isDir) {
        queue.push(entry.path);
      } else {
        files.push(entry);
        if (Number.isFinite(entry.size)) {
          totalBytes += entry.size;
        }
      }
    });

    setDownloadState((prev) => ({
      ...prev,
      processedDirs: 0,
      queuedDirs: queue.length
    }));

    while (queue.length > 0) {
      if (signal.aborted) {
        throw new DOMException('Download cancelled', 'AbortError');
      }
      const dirPath = queue.shift();
      if (!dirPath || visited.has(dirPath)) {
        continue;
      }
      visited.add(dirPath);
      const listing = await fetchList(dirPath, { signal });
      const entriesInDir = Array.isArray(listing.entries) ? listing.entries : [];
      entriesInDir.forEach((entry) => {
        if (!entry?.path) return;
        if (entry.isDir) {
          queue.push(entry.path);
        } else {
          files.push(entry);
          if (Number.isFinite(entry.size)) {
            totalBytes += entry.size;
          }
        }
      });
      setDownloadState((prev) => ({
        ...prev,
        processedDirs: prev.processedDirs + 1,
        queuedDirs: queue.length
      }));
    }

    return { files, totalBytes };
  }, []);

  const updateProgress = useCallback((delta) => {
    progressRef.current.bytes += delta;
    const now = typeof performance === 'undefined' ? Date.now() : performance.now();
    if (now - progressRef.current.lastUpdate < PROGRESS_UPDATE_MS) return;
    progressRef.current.lastUpdate = now;
    setDownloadState((prev) => ({
      ...prev,
      processedBytes: progressRef.current.bytes
    }));
  }, []);

  const discoverSelection = useCallback(async (overrideEntries) => {
    const entriesToDownload = Array.isArray(overrideEntries) && overrideEntries.length > 0
      ? overrideEntries
      : Array.from(selectedEntries.values());
    if (entriesToDownload.length === 0) return null;
    if (downloadState.status === 'listing'
      || downloadState.status === 'downloading'
      || downloadState.status === 'finalizing') return null;

    const writerMode = getWriterMode();
    const controller = new AbortController();
    abortRef.current = controller;

    setDownloadState({
      status: 'listing',
      processedFiles: 0,
      totalFiles: 0,
      processedBytes: 0,
      totalBytes: 0,
      processedDirs: 0,
      queuedDirs: 0,
      currentFile: '',
      error: '',
      warning: getWriterWarning(writerMode)
    });

    try {
      if (Array.isArray(overrideEntries) && overrideEntries.length > 0) {
        setSelectedEntries(new Map(
          overrideEntries
            .filter((entry) => entry?.path)
            .map((entry) => [entry.path, normalizeEntry(entry)])
        ));
      }
      const { files, totalBytes } = await expandSelection(entriesToDownload, controller.signal);
      const totalFiles = files.length;
      if (totalFiles === 0) {
        setDownloadState((prev) => ({
          ...prev,
          status: 'error',
          error: 'No files found in the selection.'
        }));
        return null;
      }
      setDownloadState(INITIAL_DOWNLOAD_STATE);
      return {
        files,
        totalBytes,
        totalFiles,
        writerMode
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        setDownloadState((prev) => ({
          ...prev,
          status: 'cancelled',
          error: ''
        }));
      } else {
        setDownloadState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || 'Failed to prepare download.'
        }));
      }
      return null;
    } finally {
      abortRef.current = null;
    }
  }, [downloadState.status, expandSelection, getWriterMode, getWriterWarning, normalizeEntry, selectedEntries]);

  const downloadSelection = useCallback(async (overrideEntries, prepared) => {
    const entriesToDownload = Array.isArray(overrideEntries) && overrideEntries.length > 0
      ? overrideEntries
      : Array.from(selectedEntries.values());
    if (entriesToDownload.length === 0) return;
    if (downloadState.status === 'listing'
      || downloadState.status === 'downloading'
      || downloadState.status === 'finalizing') return;

    const writerMode = prepared?.writerMode || getWriterMode();
    const controller = new AbortController();
    abortRef.current = controller;
    progressRef.current = { bytes: 0, lastUpdate: 0 };

    const preparedFiles = prepared?.files || null;
    const preparedBytes = Number.isFinite(prepared?.totalBytes) ? prepared.totalBytes : null;

    setDownloadState({
      status: preparedFiles ? 'downloading' : 'listing',
      processedFiles: 0,
      totalFiles: preparedFiles ? preparedFiles.length : 0,
      processedBytes: 0,
      totalBytes: preparedBytes || 0,
      processedDirs: 0,
      queuedDirs: 0,
      currentFile: '',
      error: '',
      warning: getWriterWarning(writerMode)
    });

    let writer = null;
    try {
      if (Array.isArray(overrideEntries) && overrideEntries.length > 0) {
        setSelectedEntries(new Map(
          overrideEntries
            .filter((entry) => entry?.path)
            .map((entry) => [entry.path, normalizeEntry(entry)])
        ));
      }
      const selectionResult = preparedFiles
        ? { files: preparedFiles, totalBytes: preparedBytes || 0 }
        : await expandSelection(entriesToDownload, controller.signal);
      const { files, totalBytes } = selectionResult;
      const totalFiles = files.length;
      if (totalFiles === 0) {
        setDownloadState((prev) => ({
          ...prev,
          status: 'error',
          error: 'No files found in the selection.'
        }));
        return;
      }

      if (!preparedFiles) {
        setDownloadState((prev) => ({
          ...prev,
          status: 'downloading',
          totalFiles,
          totalBytes
        }));
      }

      const suggestedName = `archive-${new Date().toISOString().slice(0, 10)}.zip`;
      writer = await createZipWriter(suggestedName, writerMode);

      let writeChain = Promise.resolve();
      let finalizeResolve;
      let finalizeReject;
      const finalizePromise = new Promise((resolve, reject) => {
        finalizeResolve = resolve;
        finalizeReject = reject;
      });

      const zip = new Zip((error, data, final) => {
        if (error) {
          finalizeReject(error);
          return;
        }
        writeChain = writeChain.then(() => writer.write(data));
        if (final) {
          writeChain.then(finalizeResolve).catch(finalizeReject);
        }
      });

      const errors = [];
      let processedFiles = 0;

      for (const file of files) {
        if (controller.signal.aborted) {
          throw new DOMException('Download cancelled', 'AbortError');
        }
        const entryName = file.path?.startsWith('/')
          ? file.path.slice(1)
          : (file.path || file.name || 'file');
        setDownloadState((prev) => ({
          ...prev,
          currentFile: entryName
        }));
        const response = await fetch(buildFileUrl(file.path), { signal: controller.signal });
        if (!response.ok || !response.body) {
          errors.push({ path: entryName, status: response.status });
          processedFiles += 1;
          setDownloadState((prev) => ({
            ...prev,
            processedFiles
          }));
          continue;
        }

        const passThrough = new ZipPassThrough(entryName);
        zip.add(passThrough);
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          passThrough.push(value);
          updateProgress(value.length);
        }
        passThrough.push(new Uint8Array(), true);

        processedFiles += 1;
        setDownloadState((prev) => ({
          ...prev,
          processedFiles
        }));
      }

      setDownloadState((prev) => ({
        ...prev,
        status: 'finalizing'
      }));
      zip.end();
      await finalizePromise;
      await writer.close();

      setDownloadState((prev) => ({
        ...prev,
        status: errors.length > 0 ? 'warning' : 'done',
        error: errors.length > 0
          ? `${errors.length} file${errors.length === 1 ? '' : 's'} failed to download.`
          : ''
      }));
    } catch (error) {
      if (writer) {
        await writer.abort(error);
      }
      if (error.name === 'AbortError') {
        setDownloadState((prev) => ({
          ...prev,
          status: 'cancelled',
          error: ''
        }));
      } else {
        setDownloadState((prev) => ({
          ...prev,
          status: 'error',
          error: error.message || 'Download failed.'
        }));
      }
    } finally {
      abortRef.current = null;
    }
  }, [downloadState.status, expandSelection, getWriterMode, getWriterWarning, normalizeEntry, selectedEntries, updateProgress]);

  return {
    selectionMode,
    selectedPaths,
    selectedCount,
    toggleSelectionMode,
    setSelectionMode: setSelectionModeSafe,
    toggleSelection,
    setSelectionEntries,
    clearSelection,
    discoverSelection,
    downloadSelection,
    cancelDownload,
    resetDownloadState,
    downloadState
  };
};
