import '../../styles/components/icons.css';
import { isArchiveEntry } from '../../lib/fileTypes.js';

export const IconFolder = () => <i className="bi bi-folder2 icon" aria-hidden="true" />;
export const IconFile = () => <i className="bi bi-file-earmark icon" aria-hidden="true" />;
export const IconImage = () => <i className="bi bi-image icon" aria-hidden="true" />;
export const IconVideo = () => <i className="bi bi-film icon" aria-hidden="true" />;
export const IconAudio = () => <i className="bi bi-music-note-beamed icon" aria-hidden="true" />;
export const IconArchive = () => <i className="bi bi-file-zip icon" aria-hidden="true" />;
export const IconDoc = () => <i className="bi bi-file-text icon" aria-hidden="true" />;
export const IconGrid = () => <i className="bi bi-grid-3x3-gap icon" aria-hidden="true" />;
export const IconList = () => <i className="bi bi-list icon" aria-hidden="true" />;

export const iconForEntry = (entry) => {
  if (entry.isDir) return <IconFolder />;
  if (entry.type === 'video') return <IconVideo />;
  if (isArchiveEntry(entry)) return <IconArchive />;
  switch (entry.type) {
    case 'image':
      return <IconImage />;
    case 'audio':
      return <IconAudio />;
    case 'document':
    case 'text':
      return <IconDoc />;
    default:
      return <IconFile />;
  }
};
