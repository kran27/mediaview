export const matchesEtag = (headerValue, etag) => {
  if (!headerValue) return false;
  const candidates = headerValue
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.startsWith('W/') ? value.slice(2) : value));
  return candidates.includes('*') || candidates.includes(etag);
};
