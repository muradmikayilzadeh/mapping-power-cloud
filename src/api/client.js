// Thin fetch wrapper for the self-hosted API (replaces the old direct
// Firestore/Storage SDK calls). Always sends the session cookie so admin
// requests stay authenticated.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  });

  // Mirrors the old `docSnap.exists() ? data : null` shape every single-doc
  // Firestore read used, so call sites that already handle "not found" as
  // null need no changes.
  if (res.status === 404) return null;
  if (res.status === 204) return null;

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch (e) {
      // response wasn't JSON — keep the status-based message
    }
    throw new Error(message);
  }

  return res.json();
}

export const apiGet = (path) => request(path);

export const apiPost = (path, body) =>
  request(path, { method: 'POST', body: JSON.stringify(body) });

export const apiPut = (path, body) =>
  request(path, { method: 'PUT', body: JSON.stringify(body) });

export const apiDelete = (path) => request(path, { method: 'DELETE' });

// `meta` fields (category/dir/filenamePrefix) are appended before `file` so
// they're always available to the server regardless of form field order.
export const apiUpload = (file, meta = {}) => {
  const form = new FormData();
  Object.entries(meta).forEach(([key, value]) => {
    if (value !== undefined && value !== null) form.append(key, value);
  });
  form.append('file', file);
  return request('/api/uploads', { method: 'POST', body: form });
};

// Uploaded files are stored (and returned by the API) as paths relative to
// the API server, e.g. `/uploads/maps/raster/<id>/file.png` — relative so
// they keep working no matter what domain/port the server is reached at. In
// production the same process serves the built frontend and `/uploads` from
// one origin, so this is a no-op there; in dev (frontend on :3000, API on
// :4000) it points asset URLs at the API origin. Only a bare, single-slash
// path (our own relative upload path) gets prefixed — everything else
// (absolute http(s) URLs, protocol-relative `//`, and local `data:`/`blob:`
// previews of a not-yet-uploaded file) passes through unchanged.
export const resolveAssetUrl = (url) => {
  if (!url || typeof url !== 'string') return url;
  if (!url.startsWith('/') || url.startsWith('//')) return url;
  return `${API_URL}${url}`;
};

export { API_URL };
