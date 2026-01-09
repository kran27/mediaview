export const buildStats = (entries) =>
  entries.reduce(
    (acc, entry) => {
      if (entry.isDir) {
        acc.dirs += 1;
      } else {
        acc.files += 1;
        acc.size += entry.size || 0;
      }
      return acc;
    },
    { dirs: 0, files: 0, size: 0 }
  );
