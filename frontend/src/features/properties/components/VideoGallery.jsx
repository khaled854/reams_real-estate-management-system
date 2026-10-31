import { useState } from 'react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import { deletePropertyVideo } from '../../../services/propertyService';
import Spinner from '../../../components/common/Spinner';
import { ConfirmModal } from '../../../components/common/Modal';
import { getVideoUrl } from '../../../utils/imageUrl';

/**
 * VideoGallery
 * Renders uploaded property videos with an HTML5 player and optional delete.
 *
 * Props:
 *   propertyId — property id
 *   videos     — [{ id, video_path, title, mime_type, file_size, sort_order }]
 *   canDelete  — boolean
 *   onDeleted  — callback after successful delete
 */
function VideoGallery({ propertyId, videos = [], canDelete = false, onDeleted }) {
  const [deletingId, setDeletingId] = useState(null);
  const [confirmId,  setConfirmId]  = useState(null);

  const handleDelete = async () => {
    const id = confirmId;
    setConfirmId(null);
    setDeletingId(id);
    try {
      await deletePropertyVideo(propertyId, id);
      toast.success('Video deleted');
      onDeleted?.();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete video');
    } finally {
      setDeletingId(null);
    }
  };

  function fmtSize(bytes) {
    if (!bytes) return null;
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed border-dark-200 rounded-xl">
        <svg className="w-10 h-10 text-dark-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
        <p className="text-sm text-dark-500">No videos uploaded yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {[...videos].sort((a, b) => a.sort_order - b.sort_order).map((video) => (
          <div
            key={video.id}
            className="group rounded-xl overflow-hidden border border-dark-200 bg-dark-900"
          >
            {/* Player */}
            <video
              key={video.video_path} // re-mount when path changes
              controls
              preload="metadata"
              className="w-full max-h-[420px] bg-black"
              style={{ display: 'block' }}
            >
              <source src={getVideoUrl(video.video_path)} type={video.mime_type || 'video/mp4'} />
              Your browser does not support HTML5 video.
            </video>

            {/* Footer bar */}
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-dark-800">
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-dark-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <span className="text-sm text-dark-200 truncate">
                  {video.title || `Video ${video.id}`}
                </span>
                {fmtSize(video.file_size) && (
                  <span className="text-xs text-dark-400 shrink-0">
                    · {fmtSize(video.file_size)}
                  </span>
                )}
              </div>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => setConfirmId(video.id)}
                  disabled={deletingId === video.id}
                  className={clsx(
                    'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                    'bg-dark-700 text-dark-300 hover:bg-danger hover:text-white transition-colors'
                  )}
                  aria-label="Delete video"
                >
                  {deletingId === video.id ? (
                    <Spinner size="xs" color="white" />
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Delete
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        isOpen={confirmId !== null}
        onClose={() => setConfirmId(null)}
        onConfirm={handleDelete}
        title="Delete Video"
        message="Are you sure you want to delete this video? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}

export default VideoGallery;
