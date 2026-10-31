/**
 * imageUrl.js
 * Central utility for building URLs for uploaded media (images and videos).
 *
 * All uploaded files are served by Express at /uploads/<subpath>.
 * The Vite dev proxy forwards /uploads/* to the backend, so relative paths
 * work in development. In production Express serves everything from the same
 * origin so relative paths also work there.
 *
 * VITE_UPLOADS_URL — set only when the backend is on a different origin
 * (e.g. LAN deployments where the browser uses a different host than Vite).
 * Leave empty for standard dev and production.
 */

const UPLOADS_ORIGIN = import.meta.env.VITE_UPLOADS_URL ?? '';

/**
 * Build a URL for a stored media file.
 *
 * @param {string|null|undefined} mediaPath  — relative path from DB, e.g. "properties/abc.jpg"
 * @returns {string|null}
 */
export function getImageUrl(mediaPath) {
  if (!mediaPath) return null;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath; // already absolute
  return `${UPLOADS_ORIGIN}/uploads/${mediaPath}`;
}

/**
 * Same as getImageUrl — alias kept for semantic clarity when used with videos.
 * e.g. getVideoUrl(video.video_path) → "/uploads/videos/abc.mp4"
 */
export const getVideoUrl = getImageUrl;

export default getImageUrl;
