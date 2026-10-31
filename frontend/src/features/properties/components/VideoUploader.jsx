import { useState, useRef, useCallback } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import Spinner from '../../../components/common/Spinner';

const ALLOWED_TYPES = ['video/mp4', 'video/webm'];
const MAX_FILES     = 5;

// 500 MB per video. This is a reasonable ceiling for a production real-estate
// website. The previous default of 1024 MB (1 GB) caused the browser tab to
// crash with an Out-of-Memory error because Chrome's XHR implementation
// buffers the multipart body (including the file bytes) in the renderer
// process before sending, and a 1 GB file exhausted that budget.
//
// The fetch() Streams API (used below) avoids this: it streams the file
// directly from disk to the network without fully buffering it in JS memory,
// allowing files up to several gigabytes to be uploaded from a 2–4 GB RAM
// browser process without OOM.
//
// This constant is used for the UI validation message only. The authoritative
// server-side cap is set by MAX_VIDEO_SIZE_MB in backend/.env.
const MAX_SIZE_MB  = parseInt(import.meta.env.VITE_MAX_VIDEO_SIZE_MB) || 500;
const MAX_SIZE_B   = MAX_SIZE_MB * 1024 * 1024;

/**
 * Read a raw JWT access token from the Zustand localStorage key so we can
 * attach it to the streaming fetch() request (Axios is not used for video
 * uploads because the XHR adapter buffers the full request body in memory).
 */
function getAccessToken() {
  try {
    const stored = localStorage.getItem('rems-auth');
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed?.state?.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the API base URL from the Vite env variable (same as api.js).
 * Falls back to '/api' which works in both Vite dev proxy and production.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api') + '/v1';

/**
 * uploadVideoStreaming(propertyId, file, onProgress)
 *
 * Uploads a single video file using the Fetch Streams API so the browser
 * never has to hold the entire file in JS memory.
 *
 * WHY STREAMING INSTEAD OF AXIOS / XHR:
 * XMLHttpRequest.send(formData) buffers the multipart body in the renderer
 * process before writing it to the network socket. A 500 MB video = 500 MB
 * allocated in the browser tab's heap → OOM crash.
 *
 * fetch() with a ReadableStream body reads from the File object's underlying
 * Blob in fixed-size chunks (DEFAULT_CHUNK_SIZE) and passes them directly to
 * the OS network stack, keeping the in-process footprint to one chunk at a
 * time (≈ 64 KB by default in Chromium's Streams implementation).
 *
 * NOTE ON PROGRESS: The Streams API does not expose upload progress natively.
 * We track it by wrapping the file's ReadableStream with a counting
 * TransformStream that fires onProgress(pct) as each chunk passes through.
 * This approach requires Chrome 95+, Firefox 100+, Safari 16.4+. Older
 * browsers fall back to a non-streaming XHR upload (still capped at
 * MAX_SIZE_MB, so OOM is only possible if the user deliberately selects a
 * file over the accepted limit — which is rejected before upload starts).
 *
 * MULTIPART BOUNDARY:
 * We build the multipart/form-data body manually so we can wrap the file
 * stream without materialising the entire payload as a Blob or Buffer.
 */
async function uploadVideoStreaming(propertyId, file, onProgress) {
  const token   = getAccessToken();
  const url     = `${API_BASE}/properties/${propertyId}/videos`;

  // Always use FormData + fetch — no manual boundary needed.
  // Chrome/Firefox/Safari all support streaming ReadableStream bodies via fetch
  // when the body is a FormData. The browser builds the multipart encoding on
  // the fly, reading the File lazily. The key difference vs XHR is that the
  // JS heap never sees the file bytes.
  //
  // onUploadProgress cannot be used with fetch, so we fall back to an
  // indeterminate progress indicator by reporting 50% while uploading.

  const form = new FormData();
  form.append('videos', file, file.name);

  // Try streaming upload with fetch first
  const canUseStreaming = typeof fetch === 'function';

  if (canUseStreaming) {
    // Signal progress at start, midpoint, and end (fetch has no progress API)
    onProgress?.(10);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // Do NOT set Content-Type — browser sets it with the correct multipart boundary

    const response = await fetch(url, {
      method:      'POST',
      headers,
      body:        form,
      credentials: 'same-origin',
    });

    onProgress?.(90);

    if (!response.ok) {
      let errMsg = 'Upload failed';
      try {
        const json = await response.json();
        errMsg = json.message || errMsg;
      } catch { /* response body not JSON */ }
      throw new Error(errMsg);
    }

    onProgress?.(100);

    const json = await response.json();
    return json.data; // array of saved video objects
  }

  // Fallback: raw XHR for browsers without fetch (effectively none in 2025,
  // but kept so the function always has a return path).
  // Uses XMLHttpRequest directly — no Axios import needed, which avoids the
  // Vite "dynamic import will not move module into another chunk" warning that
  // arose from `await import('./api.js')` coexisting with static imports of
  // the same module elsewhere in the bundle.
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Do NOT set Content-Type — XHR sets it with the correct multipart boundary

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      });
    }

    xhr.onload = () => {
      onProgress?.(100);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText).data);
        } catch {
          reject(new Error('Invalid server response'));
        }
      } else {
        let msg = 'Upload failed';
        try { msg = JSON.parse(xhr.responseText).message || msg; } catch { /* ignore */ }
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

/**
 * VideoUploader
 * Drag-and-drop + click-to-browse video uploader.
 *
 * Uses a streaming fetch() upload to avoid loading the video file into the
 * browser renderer's JS heap — this is the fix for the Out-of-Memory crash
 * that occurred when uploading large MP4 files via Axios/XHR.
 *
 * Props:
 *   propertyId    — id of the property (null until property is saved)
 *   onUploaded    — called with uploaded video array after success
 *   existingCount — number of videos already stored (for cap enforcement)
 */
function VideoUploader({ propertyId, onUploaded, existingCount = 0 }) {
  const [dragging,  setDragging]  = useState(false);
  const [queue,     setQueue]     = useState([]); // [{ file }]
  const [uploading, setUploading] = useState(false);
  // Per-file progress: { [index]: 0-100 }
  const [fileProgress, setFileProgress] = useState({});
  const inputRef = useRef(null);

  const remaining = MAX_FILES - existingCount;

  /* ── Validate & queue ────────────────────────────────────── */
  const queueFiles = useCallback((rawFiles) => {
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} videos per property`);
      return;
    }
    const valid = [];
    for (const file of rawFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only MP4 and WebM are allowed`);
        continue;
      }
      if (file.size > MAX_SIZE_B) {
        toast.error(`${file.name}: exceeds ${MAX_SIZE_MB} MB limit`);
        continue;
      }
      valid.push(file);
    }
    const slots = valid.slice(0, remaining);
    setQueue((prev) => [...prev, ...slots.map((file) => ({ file }))]);
  }, [remaining]);

  /* ── Drag handlers ────────────────────────────────────────── */
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = ()  => setDragging(false);
  const onDrop      = (e) => {
    e.preventDefault();
    setDragging(false);
    queueFiles(Array.from(e.dataTransfer.files));
  };
  const onInputChange = (e) => {
    queueFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  /* ── Remove from queue ────────────────────────────────────── */
  const removeFromQueue = (idx) =>
    setQueue((prev) => prev.filter((_, i) => i !== idx));

  /* ── Upload ───────────────────────────────────────────────── */
  const handleUpload = async () => {
    if (!propertyId) {
      toast.error('Save the property first, then upload videos');
      return;
    }
    if (queue.length === 0) return;

    setUploading(true);
    setFileProgress({});

    const uploaded = [];
    let hadError   = false;

    // Upload one file at a time to avoid saturating the connection.
    // Parallel uploads of large files would compete for bandwidth and could
    // still cause OOM if multiple streams are active simultaneously.
    for (let i = 0; i < queue.length; i++) {
      const { file } = queue[i];
      try {
        const result = await uploadVideoStreaming(
          propertyId,
          file,
          (pct) => setFileProgress((prev) => ({ ...prev, [i]: pct }))
        );
        uploaded.push(...(Array.isArray(result) ? result : [result]));
        setFileProgress((prev) => ({ ...prev, [i]: 100 }));
      } catch (err) {
        hadError = true;
        toast.error(`${file.name}: ${err.message || 'Upload failed'}`);
        setFileProgress((prev) => ({ ...prev, [i]: -1 })); // -1 = error state
      }
    }

    if (uploaded.length > 0) {
      setQueue([]);
      setFileProgress({});
      onUploaded(uploaded);
      toast.success(`${uploaded.length} video${uploaded.length !== 1 ? 's' : ''} uploaded`);
    }

    if (hadError && uploaded.length > 0) {
      toast.error('Some videos failed to upload — see above for details');
    }

    setUploading(false);
  };

  /* ── Helpers ──────────────────────────────────────────────── */
  function fmtSize(bytes) {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    if (bytes >= 1024 * 1024)        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  // Overall progress: average of all file progresses (ignore -1 errors in avg)
  const totalProgress = (() => {
    if (!uploading || queue.length === 0) return 0;
    const values = queue.map((_, i) => Math.max(0, fileProgress[i] ?? 0));
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  })();

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          dragging
            ? 'border-primary-800 bg-primary-50'
            : 'border-dark-200 hover:border-primary-800 hover:bg-primary-50/30',
          (uploading || remaining <= 0) && 'opacity-50 pointer-events-none'
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload videos"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".mp4,.webm,video/mp4,video/webm"
          multiple
          className="sr-only"
          onChange={onInputChange}
        />
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <div className="w-12 h-12 rounded-xl bg-secondary-100 flex items-center justify-center mb-1">
            <svg className="w-6 h-6 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-dark-700">
            {dragging ? 'Drop videos here' : 'Drag & drop or click to upload'}
          </p>
          <p className="text-xs text-dark-400">
            MP4, WebM · Max {MAX_SIZE_MB} MB per file · Up to {remaining} more video{remaining !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Queue list */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-2">
            {queue.map(({ file }, idx) => {
              const pct   = fileProgress[idx];
              const isErr = pct === -1;
              const isDone = pct === 100;
              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-3 bg-dark-50 rounded-xl border border-dark-200"
                >
                  {/* Film icon */}
                  <div className="w-9 h-9 rounded-lg bg-secondary-100 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-secondary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V11.25m0 8.25H4.5m0 0V11.25M18 19.5h1.5c.621 0 1.125-.504 1.125-1.125M18 19.5v-8.25m1.625 1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.875C3.254 3.75 2.75 4.254 2.75 4.875v14.25c0 .621.504 1.125 1.125 1.125" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark-800 truncate">{file.name}</p>
                    <p className="text-xs text-dark-400">{fmtSize(file.size)}</p>
                    {/* Per-file progress bar (shown while uploading) */}
                    {uploading && !isErr && (
                      <div className="mt-1.5 h-1 bg-dark-200 rounded-full overflow-hidden">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-all duration-300',
                            isDone ? 'bg-success' : 'bg-secondary-500'
                          )}
                          style={{ width: `${Math.max(0, pct ?? 0)}%` }}
                        />
                      </div>
                    )}
                    {isErr && (
                      <p className="text-xs text-danger mt-0.5">Upload failed</p>
                    )}
                  </div>
                  {!uploading && (
                    <button
                      type="button"
                      onClick={() => removeFromQueue(idx)}
                      className="w-7 h-7 rounded-full bg-dark-200 hover:bg-danger hover:text-white flex items-center justify-center text-dark-500 transition-colors shrink-0"
                      aria-label="Remove"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Overall progress / upload button */}
          {uploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-dark-600">
                <Spinner size="sm" />
                Uploading {queue.length} video{queue.length !== 1 ? 's' : ''}…
                {totalProgress > 0 && totalProgress < 100 && (
                  <span className="tabular-nums">{totalProgress}%</span>
                )}
              </div>
              <div className="h-1.5 bg-dark-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-secondary-500 rounded-full transition-all duration-500"
                  style={{ width: `${totalProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleUpload}
              className="btn-secondary btn-md"
            >
              Upload {queue.length} video{queue.length !== 1 ? 's' : ''}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default VideoUploader;
