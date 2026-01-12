export const readUrlState = () => {
  const params = new URLSearchParams(window.location.search);
  const rawPath = window.location.pathname.replace(/^\/+/, '');
  const decodedPath = rawPath
    ? rawPath
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/')
    : '';
  const preview = params.get('preview') || params.get('item') || '';
  return {
    path: decodedPath,
    preview
  };
};

export const buildUrlState = (state) => {
  const params = new URLSearchParams();
  if (state.preview) params.set('preview', state.preview);
  const query = params.toString();
  const pathname = state.path
    ? `/${state.path
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`
    : '/';
  return `${pathname}${query ? `?${query}` : ''}`;
};

export const setUrlState = (state, { replace = false } = {}) => {
  const nextUrl = buildUrlState(state);
  if (replace) {
    window.history.replaceState(null, '', nextUrl);
  } else {
    window.history.pushState(null, '', nextUrl);
  }
};
