import { useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { deletePropertyImage } from '../../../services/propertyService';
import Spinner from '../../../components/common/Spinner';
import { ConfirmModal } from '../../../components/common/Modal';
import { getImageUrl } from '../../../utils/imageUrl';

/* ── Lightbox ─────────────────────────────────────────────── */
function Lightbox({ images, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const current = images[idx];

  const prev = (e) => { e.stopPropagation(); setIdx((i) => (i - 1 + images.length) % images.length); };
  const next = (e) => { e.stopPropagation(); setIdx((i) => (i + 1) % images.length); };

  return createPortal(
    <div
      className="fixed inset-0 z-modal bg-dark-900/95 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        aria-label="Close"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Prev */}
      {images.length > 1 && (
        <button
          onClick={prev}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Image */}
      <div className="max-w-4xl max-h-[80vh] mx-auto" onClick={(e) => e.stopPropagation()}>
        <img
          src={getImageUrl(current.image_path)}
          alt=""
          className="max-h-[75vh] max-w-full object-contain rounded-lg"
        />
        <p className="text-center text-white/50 text-sm mt-3">
          {idx + 1} / {images.length}
          {current.is_cover === 1 && (
            <span className="ml-2 text-secondary-500 font-medium">· Cover</span>
          )}
        </p>
      </div>

      {/* Next */}
      {images.length > 1 && (
        <button
          onClick={next}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>,
    document.body
  );
}

/**
 * ImageGallery
 * Displays existing property images with delete + lightbox.
 *
 * Props:
 *   propertyId — id
 *   images     — [{ id, image_path, is_cover, sort_order }]
 *   canDelete  — boolean
 *   onDeleted  — callback after successful delete
 */
function ImageGallery({ propertyId, images = [], canDelete = false, onDeleted }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [deletingId,  setDeletingId]  = useState(null);
  const [confirmId,   setConfirmId]   = useState(null);

  const handleDelete = async () => {
    setDeletingId(confirmId);
    setConfirmId(null);
    try {
      await deletePropertyImage(propertyId, confirmId);
      toast.success('Image deleted');
      onDeleted?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete image');
    } finally {
      setDeletingId(null);
    }
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-dark-200 rounded-xl">
        <svg className="w-10 h-10 text-dark-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <p className="text-sm text-dark-500">No images uploaded yet</p>
      </div>
    );
  }

  // Sort: cover first, then by sort_order
  const sorted = [...images].sort((a, b) => {
    if (a.is_cover && !b.is_cover) return -1;
    if (!a.is_cover && b.is_cover) return 1;
    return a.sort_order - b.sort_order;
  });

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {sorted.map((img, idx) => (
          <div
            key={img.id}
            className={clsx(
              'relative group aspect-square rounded-lg overflow-hidden border-2 cursor-pointer',
              img.is_cover ? 'border-secondary-500' : 'border-dark-100'
            )}
          >
            <img
              src={getImageUrl(img.image_path)}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onClick={() => setLightboxIdx(idx)}
              loading="lazy"
            />

            {/* Cover badge */}
            {img.is_cover === 1 && (
              <div className="absolute top-1.5 left-1.5">
                <span className="text-2xs font-semibold bg-secondary-500 text-white px-1.5 py-0.5 rounded-full">
                  Cover
                </span>
              </div>
            )}

            {/* Delete button */}
            {canDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmId(img.id); }}
                disabled={deletingId === img.id}
                className={clsx(
                  'absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center',
                  'bg-danger text-white opacity-0 group-hover:opacity-100',
                  'transition-opacity duration-150 hover:bg-danger-dark',
                  deletingId === img.id && 'opacity-100'
                )}
                aria-label="Delete image"
              >
                {deletingId === img.id ? (
                  <Spinner size="xs" color="white" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>
            )}

            {/* Expand hint */}
            <div className="absolute inset-0 bg-dark-900/0 group-hover:bg-dark-900/20 transition-colors pointer-events-none" />
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          images={sorted}
          startIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {/* Confirm delete */}
      <ConfirmModal
        isOpen={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Image"
        message="Are you sure you want to delete this image? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

export default ImageGallery;
