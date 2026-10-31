import { useState, useRef, useCallback } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { uploadPropertyImages } from '../../../services/propertyService';
import Spinner from '../../../components/common/Spinner';

const ALLOWED_TYPES  = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILES      = 10;

// Source-file size gate (10 MB). Files larger than this are rejected before
// compression — if the raw file is already >10 MB the quality of the original
// is low enough that compressing it won't meaningfully help the UX, and we
// want a fast, obvious rejection message rather than a slow re-encode.
const MAX_SOURCE_MB  = parseInt(import.meta.env.VITE_MAX_FILE_SIZE_MB) || 10;
const MAX_SOURCE_B   = MAX_SOURCE_MB * 1024 * 1024;

// After compression, the resulting blob is expected to be well under 2 MB.
// We enforce a server-side limit in the backend .env (MAX_FILE_SIZE_MB=10) as
// the authoritative cap; this client-side constant is just for UI feedback.
const MAX_OUTPUT_MB  = 10;
const MAX_OUTPUT_B   = MAX_OUTPUT_MB * 1024 * 1024;

// Resize to at most this dimension on the longest axis. Real-estate photos
// are displayed at ≤1920 px; storing more than that wastes disk and memory.
const MAX_DIMENSION  = 1920;
// JPEG quality after re-encode. 0.85 gives visually lossless results at
// ≈70–85 % size reduction versus the decoded-then-re-saved original.
const JPEG_QUALITY   = 0.85;

/**
 * compressImage(file) → Promise<{ blob: Blob, url: string, name: string }>
 *
 * Resizes the image to MAX_DIMENSION × MAX_DIMENSION (preserving aspect ratio)
 * and re-encodes it as image/jpeg at JPEG_QUALITY.
 *
 * Uses OffscreenCanvas when available (works in all workers and modern main
 * threads). Falls back to an HTMLCanvasElement for older browsers.
 *
 * WHY THIS EXISTS:
 * A typical real-estate JPEG (6000 × 4000 px, 8 MB compressed) decodes to
 * 6000 × 4000 × 4 bytes ≈ 96 MB of uncompressed bitmap in the browser's
 * renderer process. Uploading 10 such images simultaneously crashes the tab
 * with an OOM error before a single byte reaches the server. Compressing to
 * 1920 px / 85 % quality reduces each decoded frame to ≈ 6 MB — a safe,
 * user-visible size — while producing output that is indistinguishable at any
 * normal display resolution.
 */
async function compressImage(file) {
  // createImageBitmap reads and decodes the file exactly once, then the
  // original File can be discarded. It does NOT store the full bitmap in the
  // JS heap — the browser manages it as a GPU texture / paint resource.
  const bitmap = await createImageBitmap(file);

  const { width: origW, height: origH } = bitmap;

  // Calculate target dimensions, preserving aspect ratio
  let targetW = origW;
  let targetH = origH;

  if (origW > MAX_DIMENSION || origH > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / origW, MAX_DIMENSION / origH);
    targetW = Math.round(origW * ratio);
    targetH = Math.round(origH * ratio);
  }

  // Use OffscreenCanvas if available; fall back to HTMLCanvasElement
  let canvas;
  let ctx;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(targetW, targetH);
    ctx = canvas.getContext('2d');
  } else {
    canvas = document.createElement('canvas');
    canvas.width  = targetW;
    canvas.height = targetH;
    ctx = canvas.getContext('2d');
  }

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close(); // release GPU texture immediately — key memory saving

  // Encode to JPEG blob
  let blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: JPEG_QUALITY });
  } else {
    // HTMLCanvasElement.toBlob is callback-based
    blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))),
        'image/jpeg',
        JPEG_QUALITY
      );
    });
  }

  // Derive a display name: keep original name but change extension to .jpg
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';

  return { blob, url: URL.createObjectURL(blob), name, originalName: file.name };
}

/**
 * ImageUploader
 * Drag-and-drop + click-to-browse multi-image uploader.
 *
 * Files are compressed to MAX_DIMENSION × MAX_DIMENSION / JPEG 85 % before
 * being stored in state or shown as previews. This keeps per-image decoded
 * memory at ≈ 6 MB rather than ≈ 96 MB and prevents browser-tab OOM when
 * uploading high-resolution real-estate photos.
 *
 * Props:
 *   propertyId    — id of the property to attach images to
 *   onUploaded    — called with the array of saved image objects after upload
 *   existingCount — how many images already exist (to enforce MAX_FILES cap)
 */
function ImageUploader({ propertyId, onUploaded, existingCount = 0 }) {
  const [dragging,    setDragging]    = useState(false);
  // Each entry: { blob, url, name, originalName, compressing? }
  const [previews,    setPreviews]    = useState([]);
  const [compressing, setCompressing] = useState(false); // global compression indicator
  const [uploading,   setUploading]   = useState(false);
  const [progress,    setProgress]    = useState(0);
  const inputRef = useRef(null);

  const remaining = MAX_FILES - existingCount;

  /* ── Validate, compress, and queue files ──────────────────── */
  const queueFiles = useCallback(async (rawFiles) => {
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_FILES} images per property`);
      return;
    }

    // Pre-validate type and source size before starting expensive compression
    const candidates = [];
    for (const file of rawFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG, WebP allowed`);
        continue;
      }
      if (file.size > MAX_SOURCE_B) {
        toast.error(`${file.name}: exceeds ${MAX_SOURCE_MB} MB limit`);
        continue;
      }
      candidates.push(file);
    }

    if (candidates.length === 0) return;

    const slots = candidates.slice(0, remaining);

    setCompressing(true);
    try {
      // Compress files SEQUENTIALLY — one at a time — to cap peak memory usage.
      //
      // WHY NOT Promise.all:
      // Promise.all would start createImageBitmap() for all files simultaneously.
      // Each call decodes the JPEG into an uncompressed RGBA bitmap:
      //   8 MP image (3264×2448) → 3264 × 2448 × 4 bytes ≈ 32 MB
      //   12 MP image (4032×3024) → 4032 × 3024 × 4 bytes ≈ 49 MB
      //   24 MP image (6000×4000) → 6000 × 4000 × 4 bytes ≈ 96 MB
      //
      // With 10 images in parallel that is up to 10 × 96 MB = 960 MB of
      // uncompressed bitmaps held simultaneously in the browser renderer
      // process. This exhausts the renderer heap and triggers the OOM crash.
      //
      // Sequential processing ensures at most ONE bitmap lives in memory at a
      // time. bitmap.close() is called immediately after drawImage() so the
      // GPU texture is released before the next file is decoded.
      // Peak memory stays at ≈ MAX_DIMENSION² × 4 bytes ≈ 14 MB regardless
      // of how many files are selected.
      const results = [];
      for (const file of slots) {
        try {
          results.push(await compressImage(file));
        } catch {
          // If compression fails (rare: corrupted file, unsupported subtype)
          // fall back to the original file so the user isn't silently blocked.
          toast.error(`${file.name}: could not process — using original`);
          results.push({ blob: file, url: URL.createObjectURL(file), name: file.name, originalName: file.name });
        }
      }

      // Reject any results that are still too large after compression
      const valid = results.filter((r) => {
        if (r.blob.size > MAX_OUTPUT_B) {
          toast.error(`${r.originalName}: compressed file exceeds ${MAX_OUTPUT_MB} MB`);
          URL.revokeObjectURL(r.url);
          return false;
        }
        return true;
      });

      if (valid.length > 0) {
        setPreviews((prev) => [...prev, ...valid]);
      }
    } finally {
      setCompressing(false);
    }
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
    // Reset input so the same file can be re-selected after removal
    e.target.value = '';
  };

  /* ── Remove from queue ────────────────────────────────────── */
  const removePreview = (idx) => {
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[idx].url);
      return prev.filter((_, i) => i !== idx);
    });
  };

  /* ── Upload ───────────────────────────────────────────────── */
  const handleUpload = async () => {
    if (!propertyId) { toast.error('Save the property first, then upload images'); return; }
    if (previews.length === 0) return;

    setUploading(true);
    setProgress(0);
    try {
      // previews[i].blob is the compressed Blob (a File subclass or Blob)
      // Wrap each Blob in a File so multipart/form-data sends a filename
      const files = previews.map(
        (p) => new File([p.blob], p.name, { type: 'image/jpeg' })
      );
      const images = await uploadPropertyImages(propertyId, files, setProgress);
      // Revoke all blob URLs to release memory immediately
      previews.forEach((p) => URL.revokeObjectURL(p.url));
      setPreviews([]);
      onUploaded(images);
      toast.success(`${images.length} image${images.length !== 1 ? 's' : ''} uploaded`);
    } catch (err) {
      // uploadPropertyImages uses fetch() and throws plain Error objects.
      // Fall back to err.response?.data?.message for any remaining Axios paths.
      toast.error(err.message || err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const isBusy = compressing || uploading;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          dragging
            ? 'border-primary-800 bg-primary-50'
            : 'border-dark-200 hover:border-primary-800 hover:bg-primary-50/30',
          (isBusy || remaining <= 0) && 'opacity-50 pointer-events-none'
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => !isBusy && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload images"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.webp"
          multiple
          className="sr-only"
          onChange={onInputChange}
        />
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center mb-1">
            {compressing ? (
              <Spinner size="md" />
            ) : (
              <svg className="w-6 h-6 text-primary-800" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            )}
          </div>
          <p className="text-sm font-medium text-dark-700">
            {compressing
              ? 'Processing images…'
              : dragging
              ? 'Drop images here'
              : 'Drag & drop or click to upload'}
          </p>
          <p className="text-xs text-dark-400">
            JPEG, PNG, WebP · Max {MAX_SOURCE_MB} MB · Up to {remaining} more image{remaining !== 1 ? 's' : ''}
            {' · '}Auto-resized to {MAX_DIMENSION}px
          </p>
        </div>
      </div>

      {/* Preview grid */}
      {previews.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {previews.map((p, idx) => (
              <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-dark-200">
                {/*
                  Each src is a blob: URL pointing to a compressed JPEG
                  (≤ MAX_DIMENSION × MAX_DIMENSION). The decoded bitmap is
                  ≈ 6 MB per image vs ≈ 96 MB for the raw original — safe to
                  render 10 simultaneously.
                */}
                <img src={p.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-dark-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removePreview(idx); }}
                    disabled={isBusy}
                    className="w-7 h-7 bg-danger rounded-full flex items-center justify-center text-white hover:bg-danger-dark transition-colors"
                    aria-label="Remove"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-dark-900/60">
                  <p className="text-2xs text-white truncate">{p.originalName}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Upload button + progress */}
          {uploading ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-dark-600">
                <Spinner size="sm" /> Uploading… {progress}%
              </div>
              <div className="h-1.5 bg-dark-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-800 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleUpload}
              disabled={compressing}
              className="btn-primary btn-md"
            >
              {compressing
                ? 'Processing…'
                : `Upload ${previews.length} image${previews.length !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;
