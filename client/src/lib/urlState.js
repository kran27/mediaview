export const readUrlState = () => {
  const params = new URLSearchParams(window.location.search);
  const rawPath = window.location.pathname.replace(/^\/+/, '');
  const decodedPath = rawPath
    ? rawPath
        .split('/')
        .map((segment) => decodeURIComponent(segment))
        .join('/')
    : '';
  return {
    path: decodedPath,
    item: params.get('item') || ''
  };
};

export const buildUrlState = (state) => {
  const params = new URLSearchParams();
  if (state.item) params.set('item', state.item);
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
