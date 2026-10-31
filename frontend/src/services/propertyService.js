import api from './api';

const BASE = '/v1/properties';

/* ── Types lookup ─────────────────────────────────────────── */
export const getPropertyTypes = async () => {
  const res = await api.get(`${BASE}/types`);
  return res.data.data;
};

/* ── List / search / filter ───────────────────────────────── */
export const getProperties = async (params = {}) => {
  const res = await api.get(BASE, { params });
  return res.data; // { success, data: [], meta: { total, page, limit, totalPages } }
};

/* ── Single property ──────────────────────────────────────── */
export const getProperty = async (id) => {
  const res = await api.get(`${BASE}/${id}`);
  return res.data.data;
};

/* ── Create ───────────────────────────────────────────────── */
export const createProperty = async (payload) => {
  const res = await api.post(BASE, payload);
  return res.data.data;
};

/* ── Update ───────────────────────────────────────────────── */
export const updateProperty = async (id, payload) => {
  const res = await api.put(`${BASE}/${id}`, payload);
  return res.data.data;
};

/* ── Update status only ───────────────────────────────────── */
export const updatePropertyStatus = async (id, status) => {
  const res = await api.patch(`${BASE}/${id}/status`, { status });
  return res.data.data;
};

/* ── Delete ───────────────────────────────────────────────── */
export const deleteProperty = async (id) => {
  const res = await api.delete(`${BASE}/${id}`);
  return res.data;
};

/* ── Images ───────────────────────────────────────────────── */
export const getPropertyImages = async (id) => {
  const res = await api.get(`${BASE}/${id}/images`);
  return res.data.data;
};

/**
 * Read the JWT access token from Zustand's persisted localStorage entry.
 * Used by uploadPropertyImages() to attach the Authorization header to the
 * streaming fetch() request without importing the full Axios instance.
 */
function _getAccessToken() {
  try {
    const stored = localStorage.getItem('rems-auth');
    if (!stored) return null;
    return JSON.parse(stored)?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Derive the absolute API origin so fetch() works in both dev (Vite proxy)
 * and production (same-origin Express server).
 * VITE_API_BASE_URL is '/api' in all builds → same-origin request, no CORS.
 */
const _API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '/api') + '/v1';

/**
 * Upload one or more images using the native fetch() API.
 *
 * WHY NOT AXIOS / XHR:
 * XMLHttpRequest.send(formData) copies the entire multipart body (all file
 * bytes + multipart boundaries) into the browser renderer process heap
 * before writing a single byte to the network. For 10 × 10 MB images that
 * is ≥ 100 MB of synchronous heap allocation on top of the existing React
 * component state, compressed blob previews, and browser overhead. On a
 * 2–4 GB RAM machine running Chrome this reliably triggers the
 * "Out of Memory — This page is having a problem" tab crash.
 *
 * fetch() with a FormData body does NOT buffer: it reads the File objects
 * lazily from the OS file cache in small chunks, sending each chunk to the
 * network without accumulating the full payload in JS memory. Peak
 * in-process footprint stays at ≈ one network chunk (≈ 64 KB) regardless
 * of the total upload size.
 *
 * PROGRESS: fetch() has no native onUploadProgress. We call the callback
 * at 10 % (request sent), 90 % (response received), and 100 % (parsed).
 * The bar moves in three discrete jumps rather than continuously, but it
 * gives the user confirmation that the upload is in progress without
 * requiring a separate streaming wrapper.
 *
 * @param {number}        id         — property id
 * @param {File[]}        files      — compressed File objects from ImageUploader
 * @param {Function|null} onProgress — optional (pct: 0-100) callback
 * @returns {Promise<object[]>}      — array of saved image records from the API
 */
export const uploadPropertyImages = async (id, files, onProgress) => {
  const token = _getAccessToken();
  const url   = `${_API_ORIGIN}/properties/${id}/images`;

  const form = new FormData();
  files.forEach((file) => form.append('images', file));

  onProgress?.(10);

  // Do NOT set Content-Type manually — the browser must add the multipart
  // boundary automatically. Setting it yourself omits the boundary parameter
  // and the server cannot parse the multipart body.
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, {
    method:      'POST',
    headers,
    body:        form,
    credentials: 'same-origin',
  });

  onProgress?.(90);

  if (!response.ok) {
    let message = 'Upload failed';
    try {
      const json = await response.json();
      message = json.message || message;
    } catch { /* response body was not JSON */ }
    throw new Error(message);
  }

  onProgress?.(100);

  const json = await response.json();
  return json.data; // array of saved image objects
};

/**
 * Delete a single image.
 */
export const deletePropertyImage = async (propertyId, imageId) => {
  const res = await api.delete(`${BASE}/${propertyId}/images/${imageId}`);
  return res.data;
};

/* ── Videos ───────────────────────────────────────────────── */

/** GET /api/v1/properties/:id/videos */
export const getPropertyVideos = async (id) => {
  const res = await api.get(`${BASE}/${id}/videos`);
  return res.data.data;
};

/**
 * Upload one or more videos via Axios/XHR (kept for API completeness).
 *
 * NOTE: VideoUploader.jsx uses its own streaming fetch() implementation
 * instead of this function to avoid loading the video into JS heap memory.
 * XHR.send(FormData) buffers the full multipart body in the renderer process,
 * which causes a browser tab OOM with files larger than ~300 MB.
 *
 * This export remains available for use in non-UI contexts (tests, scripts)
 * where file size is known to be small, or for fallback in environments
 * that do not support the Streams API.
 *
 * @param {number}   id    — property id
 * @param {File[]}   files — native File objects from <input>
 * @param {Function} [onProgress] — optional (pct: 0-100) callback
 */
export const uploadPropertyVideos = async (id, files, onProgress) => {
  const form = new FormData();
  files.forEach((file) => form.append('videos', file));

  const res = await api.post(`${BASE}/${id}/videos`, form, {
    headers:          { 'Content-Type': 'multipart/form-data' },
    timeout:          0,
    onUploadProgress: onProgress
      ? (e) => onProgress(Math.round((e.loaded * 100) / (e.total || e.loaded)))
      : undefined,
  });
  return res.data.data;
};

/** Delete a single video. */
export const deletePropertyVideo = async (propertyId, videoId) => {
  const res = await api.delete(`${BASE}/${propertyId}/videos/${videoId}`);
  return res.data;
};
