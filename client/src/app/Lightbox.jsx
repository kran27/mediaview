import { useEffect, useRef, useState } from 'react';
import { buildFileUrl } from '../lib/api.js';
import { formatSize } from '../lib/format.js';
import { getEntryExtension, isViewableEntry } from '../lib/fileTypes.js';
import { iconForEntry } from './components/index.js';

const LARGE_FILE_THRESHOLD_BYTES = 10 * 1024 * 1024;
const TEXT_PREVIEW_BYTES = 64 * 1024;
const VIDEO_MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.wmv': 'video/x-ms-wmv',
  '.flv': 'video/x-flv',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg'
};

const isVideoPlayable = (entry) => {
  if (entry?.type !== 'video') return true;
  if (typeof document === 'undefined') return true;
  const ext = getEntryExtension(entry);
  const mimeType = VIDEO_MIME_TYPES[ext];
  if (!mimeType) return true;
  const probe = document.createElement('video');
  const result = probe.canPlayType(mimeType);
  return result === '' || result === 'probably' || result === 'maybe';
};

const Lightbox = ({
  open,
  selectedEntry,
  lightboxEntries,
  activeIndex,
  onClose,
  onPrev,
  onNext
}) => {
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaMeta, setMediaMeta] = useState({ width: null, height: null, duration: null });
  const [textPreview, setTextPreview] = useState({
    status: 'idle',
    content: '',
    truncated: false,
    error: ''
  });
  const [largeFileWarningDismissed, setLargeFileWarningDismissed] = useState(false);
  const [videoPreviewFailed, setVideoPreviewFailed] = useState(false);
  const imageRef = useRef(null);
  const videoRef = useRef(null);
  const lightboxRef = useRef(null);
  const toolbarRef = useRef(null);

  const isVideo = selectedEntry?.type === 'video';
  const isImage = selectedEntry?.type === 'image';
  const isStreamable = isVideo || selectedEntry?.type === 'audio';
  const shouldShowDimensions = isImage || isVideo;
  const hasDimensions = Number.isFinite(mediaMeta.width) && Number.isFinite(mediaMeta.height);
  const placeholderDimensions = '-- × --';
  const isLargeFile = Number.isFinite(selectedEntry?.size)
    && selectedEntry.size >= LARGE_FILE_THRESHOLD_BYTES;
  const canPreviewVideo = !isVideo || (isVideoPlayable(selectedEntry) && !videoPreviewFailed);
  const canPreviewEntry = isViewableEntry(selectedEntry) && canPreviewVideo;
  const shouldWarnLargeFile = isLargeFile && !isStreamable && canPreviewEntry;
  const shouldGateLargeFile = shouldWarnLargeFile && !largeFileWarningDismissed;

  useEffect(() => {
    if (!open) {
      setLargeFileWarningDismissed(false);
      setVideoPreviewFailed(false);
      return;
    }
    if (selectedEntry?.isDir) {
      setLargeFileWarningDismissed(false);
      onClose();
      return;
    }
    setLargeFileWarningDismissed(false);
    setMediaLoading(false);
    setMediaMeta({ width: null, height: null, duration: null });
    setVideoPreviewFailed(false);
  }, [onClose, open, selectedEntry]);

  useEffect(() => {
    if (!open || !selectedEntry) return;
    if (isImage && imageRef.current?.complete) {
      setMediaLoading(false);
      setMediaMeta({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
        duration: null
      });
    }
    if (isVideo && videoRef.current?.readyState >= 2) {
      setMediaLoading(false);
      setMediaMeta({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
        duration: videoRef.current.duration
      });
    }
  }, [open, selectedEntry, isImage, isVideo]);

  useEffect(() => {
    if (!open || !selectedEntry) return undefined;
    if (!isImage && !isVideo) return undefined;
    const frameId = requestAnimationFrame(() => {
      if (isImage) {
        const img = imageRef.current;
        if (!img) return;
        setMediaLoading(!(img.complete && img.naturalWidth > 0));
      } else {
        const video = videoRef.current;
        if (!video) return;
        setMediaLoading(video.readyState < 2);
      }
    });
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [open, selectedEntry, isImage, isVideo]);

  useEffect(() => {
    if (!open || !selectedEntry || selectedEntry.type !== 'text') {
      setTextPreview({ status: 'idle', content: '', truncated: false, error: '' });
      return undefined;
    }
    if (shouldGateLargeFile) {
      setTextPreview({ status: 'idle', content: '', truncated: false, error: '' });
      return undefined;
    }
    let isActive = true;
    const loadText = async () => {
      setTextPreview({ status: 'loading', content: '', truncated: false, error: '' });
      try {
        const response = await fetch(buildFileUrl(selectedEntry.path), {
          headers: { Range: `bytes=0-${TEXT_PREVIEW_BYTES - 1}` }
        });
        if (!response.ok) {
          throw new Error('Failed to load text preview');
        }
        const content = await response.text();
        if (!isActive) return;
        setTextPreview({
          status: 'ready',
          content,
          truncated: response.status === 206,
          error: ''
        });
      } catch (error) {
        if (!isActive) return;
        setTextPreview({
          status: 'error',
          content: '',
          truncated: false,
          error: error.message
        });
      }
    };
    loadText();
    return () => {
      isActive = false;
    };
  }, [open, selectedEntry, shouldGateLargeFile]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowLeft') {
        onPrev();
      }
      if (event.key === 'ArrowRight') {
        onNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, onPrev, onNext]);

  useEffect(() => {
    if (!open) return undefined;
    const lightboxEl = lightboxRef.current;
    const toolbarEl = toolbarRef.current;
    if (!lightboxEl || !toolbarEl) return undefined;

    let frameId;
    const updateToolbarHeight = () => {
      if (!lightboxEl || !toolbarEl) return;
      const nextHeight = Math.ceil(toolbarEl.getBoundingClientRect().height);
      lightboxEl.style.setProperty('--lightbox-toolbar-height', `${nextHeight}px`);
    };

    updateToolbarHeight();

    let observer;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(updateToolbarHeight);
      });
      observer.observe(toolbarEl);
    }

    const handleResize = () => updateToolbarHeight();
    window.addEventListener('resize', handleResize);

    return () => {
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, [open, selectedEntry?.path]);

  if (!open || !selectedEntry || selectedEntry.isDir) return null;

  const previewSource = buildFileUrl(selectedEntry.path);

  return (
    <div className="lightbox" ref={lightboxRef} role="dialog" aria-modal="true">
      <button type="button" className="lightbox-backdrop" onClick={onClose} aria-label="Close preview" />
      <div className="lightbox-stage">
        <div
          className={`lightbox-body${selectedEntry.type === 'document' ? ' is-document' : ''}${mediaLoading ? ' is-loading' : ''}`}
        >
          <button
            type="button"
            className="lightbox-body-dismiss"
            onClick={onClose}
            aria-label="Close preview"
          />
          {shouldGateLargeFile && (
            <div className="lightbox-warning">
              <div className="lightbox-warning-title">Large file</div>
              <div className="lightbox-warning-copy">
                This file is {formatSize(selectedEntry.size)}. Loading may take a while.
              </div>
              <div className="lightbox-warning-actions">
                <button
                  type="button"
                  className="lightbox-warning-button"
                  onClick={() => setLargeFileWarningDismissed(true)}
                >
                  Load file
                </button>
                <button
                  type="button"
                  className="lightbox-warning-button is-secondary"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </div>
          )}
          {!shouldGateLargeFile && canPreviewVideo && (isImage || isVideo) && (
            <div className={`lightbox-media${mediaLoading ? ' is-loading' : ''}`}>
              {mediaLoading && <div className="media-loader" aria-hidden="true" />}
              {isImage && (
                <img
                  key={previewSource}
                  ref={imageRef}
                  src={previewSource}
                  alt={selectedEntry.name}
                  loading="eager"
                  onLoad={(event) => {
                    setMediaLoading(false);
                    setMediaMeta({
                      width: event.currentTarget.naturalWidth,
                      height: event.currentTarget.naturalHeight,
                      duration: null
                    });
                  }}
                  onError={() => {
                    setMediaLoading(false);
                  }}
                />
              )}
              {isVideo && (
                <video
                  controls
                  autoPlay
                  key={previewSource}
                  ref={videoRef}
                  src={previewSource}
                  preload="metadata"
                  onLoadedMetadata={(event) => {
                    setMediaMeta({
                      width: event.currentTarget.videoWidth,
                      height: event.currentTarget.videoHeight,
                      duration: event.currentTarget.duration
                    });
                  }}
                  onLoadedData={() => setMediaLoading(false)}
                  onError={() => {
                    setMediaLoading(false);
                    setVideoPreviewFailed(true);
                  }}
                />
              )}
            </div>
          )}
          {!shouldGateLargeFile && selectedEntry.type === 'audio' && (
            <audio
              controls
              autoPlay
              src={previewSource}
              preload="metadata"
              onLoadedMetadata={(event) => {
                setMediaMeta({
                  width: null,
                  height: null,
                  duration: event.currentTarget.duration
                });
              }}
            />
          )}
          {!shouldGateLargeFile && selectedEntry.type === 'document' && (
            <iframe
              className="lightbox-iframe"
              src={previewSource}
              title={selectedEntry.name}
            />
          )}
          {!shouldGateLargeFile && selectedEntry.type === 'text' && (
            <div className="lightbox-text">
              {textPreview.status === 'loading' && <div>Loading preview...</div>}
              {textPreview.status === 'error' && (
                <div className="lightbox-error">{textPreview.error}</div>
              )}
              {textPreview.status === 'ready' && (
                <>
                  {textPreview.truncated && <div className="lightbox-note">Showing first 64 KB.</div>}
                  <pre>{textPreview.content}</pre>
                </>
              )}
            </div>
          )}
          {!shouldGateLargeFile && (!isViewableEntry(selectedEntry) || !canPreviewVideo) && (
            <div className="lightbox-unknown">
              <div className="lightbox-unknown-title">Preview unavailable</div>
              <div className="lightbox-unknown-copy">
                This file type isn&apos;t supported. Use Download to open it.
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="lightbox-toolbar" ref={toolbarRef}>
        <div className="lightbox-meta">
          <div className="lightbox-meta-left">
            <span className="lightbox-type-icon" aria-hidden="true">
              {iconForEntry(selectedEntry)}
            </span>
            <div className="lightbox-meta-text">
              <span className="lightbox-name">{selectedEntry.name}</span>
              <div className="lightbox-meta-sub">
                {Number.isFinite(selectedEntry.size) && selectedEntry.size > 0 && (
                  <span className="lightbox-size">{formatSize(selectedEntry.size)}</span>
                )}
                {shouldShowDimensions && (
                  <span
                    className={`lightbox-dimensions${hasDimensions ? '' : ' is-loading'}`}
                    aria-hidden={!hasDimensions}
                  >
                    {hasDimensions
                      ? `${mediaMeta.width} × ${mediaMeta.height}`
                      : placeholderDimensions}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="lightbox-controls">
          <div className="lightbox-nav-group" role="group" aria-label="Navigation">
            {activeIndex >= 0 && lightboxEntries.length > 0 && (
              <span className="lightbox-count">
                {activeIndex + 1} / {lightboxEntries.length}
              </span>
            )}
            <button
              type="button"
              className="lightbox-nav"
              onClick={onPrev}
              disabled={activeIndex <= 0}
              aria-label="Previous item"
            >
              ◀
            </button>
            <button
              type="button"
              className="lightbox-nav"
              onClick={onNext}
              disabled={activeIndex >= lightboxEntries.length - 1}
              aria-label="Next item"
            >
              ▶
            </button>
          </div>
          <a
            className="lightbox-download"
            href={buildFileUrl(selectedEntry.path)}
            download={selectedEntry.name}
          >
            Download
          </a>
          <button type="button" className="lightbox-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lightbox;
