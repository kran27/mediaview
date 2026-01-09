export const VIEWABLE_TYPES = new Set(['image', 'video', 'audio', 'document', 'text']);

export const isViewableEntry = (entry) =>
  Boolean(entry && !entry.isDir && VIEWABLE_TYPES.has(entry.type));

export const fileTypeLabel = (entry) => {
  if (entry.isDir) return 'Folder';
  switch (entry.type) {
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'document':
      return 'Document';
    case 'text':
      return 'Text';
    default:
      return 'File';
  }
};
