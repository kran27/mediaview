const VIDEO_EXTS = new Set([
  '.mp4',
  '.m4v',
  '.webm',
  '.mov',
  '.mkv',
  '.avi',
  '.mpg',
  '.mpeg',
  '.wmv',
  '.flv',
  '.f4v',
  '.3gp',
  '.3g2',
  '.ogv',
  '.mts',
  '.m2ts',
  '.ts',
  '.vob',
  '.rm',
  '.rmvb',
  '.asf',
  '.mxf',
  '.m1v',
  '.m2v'
]);
const ARCHIVE_EXTS = new Set([
  '.zip',
  '.rar',
  '.7z',
  '.tar',
  '.gz',
  '.tgz',
  '.bz2',
  '.tbz',
  '.tbz2',
  '.xz',
  '.txz',
  '.lz',
  '.lzma',
  '.z',
  '.zst',
  '.iso',
  '.cab',
  '.arj',
  '.ace',
  '.jar',
  '.war',
  '.ear',
  '.apk',
  '.ipa'
]);

export const VIEWABLE_TYPES = new Set(['image', 'video', 'audio', 'document', 'text']);

export const getEntryExtension = (entry) => {
  if (!entry) return '';
  const rawExt = entry.ext
    || (entry.name && entry.name.includes('.') ? entry.name.slice(entry.name.lastIndexOf('.')) : '');
  return rawExt ? rawExt.toLowerCase() : '';
};

export const isVideoEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'video') return true;
  const ext = getEntryExtension(entry);
  return VIDEO_EXTS.has(ext);
};

export const isArchiveEntry = (entry) => {
  if (!entry || entry.isDir) return false;
  if (entry.type === 'archive') return true;
  const ext = getEntryExtension(entry);
  return ARCHIVE_EXTS.has(ext);
};

export const isViewableEntry = (entry) =>
  Boolean(entry && !entry.isDir && (VIEWABLE_TYPES.has(entry.type) || isVideoEntry(entry)));

export const fileTypeLabel = (entry) => {
  if (entry.isDir) return 'Folder';
  if (isVideoEntry(entry)) return 'Video';
  if (isArchiveEntry(entry)) return 'Archive';
  switch (entry.type) {
    case 'image':
      return 'Image';
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
