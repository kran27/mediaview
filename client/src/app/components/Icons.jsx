import React from 'react';
import './Icons.css';

export const IconFolder = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M3 6.5a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

export const IconFile = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M14 3v5h5" />
  </svg>
);

export const IconImage = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 17l-5-5-4 4-2-2-5 5" />
  </svg>
);

export const IconVideo = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <rect x="3" y="5" width="14" height="14" rx="2" />
    <path d="M17 9l4-2v10l-4-2z" />
  </svg>
);

export const IconAudio = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M9 8l6-3v14l-6-3H5V8z" />
    <path d="M19 9a4 4 0 0 1 0 6" />
  </svg>
);

export const IconDoc = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
    <path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

export const iconForEntry = (entry) => {
  if (entry.isDir) return <IconFolder />;
  switch (entry.type) {
    case 'image':
      return <IconImage />;
    case 'video':
      return <IconVideo />;
    case 'audio':
      return <IconAudio />;
    case 'document':
    case 'text':
      return <IconDoc />;
    default:
      return <IconFile />;
  }
};
