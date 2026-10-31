'use strict';

/**
 * multer.js
 * Secure file upload configuration.
 *
 * Security guarantees:
 *   1. MIME type + file extension both validated before saving.
 *   2. All filenames replaced with UUIDs — no user-controlled strings on disk.
 *   3. Upload destination is an ABSOLUTE path resolved from __dirname
 *      so it works correctly regardless of the process working directory.
 *
 * Upload instances:
 *   uploadPropertyImage  — JPEG/PNG/WebP,  saved to uploads/properties/
 *   uploadPropertyVideo  — MP4/WebM,       saved to uploads/videos/
 *   uploadDocument       — PDF/DOC/DOCX,   saved to uploads/documents/
 *   uploadAvatar         — JPEG/PNG/WebP,  saved to uploads/avatars/
 */

const multer = require('multer');
const fs     = require('fs');
const path   = require('path');
const { v4: uuidv4 } = require('uuid');

const MAX_SIZE_BYTES       = (parseInt(process.env.MAX_FILE_SIZE_MB)  || 10)   * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = (parseInt(process.env.MAX_VIDEO_SIZE_MB) || 500) * 1024 * 1024;

/**
 * Per-property media count limits.
 *
 * Setting these to Infinity removes the artificial count cap.
 * Security is maintained by:
 *   - Individual file-size limits (MAX_SIZE_BYTES / MAX_VIDEO_SIZE_BYTES)
 *   - MIME type + extension validation (imageFilter / videoFilter)
 *   - UUID filenames (no user-controlled paths on disk)
 *   - Auth + ownership checks in the controller
 *
 * Operators can cap counts via env vars if desired:
 *   MAX_IMAGES_PER_PROPERTY=50   (default: unlimited)
 *   MAX_VIDEOS_PER_PROPERTY=20   (default: unlimited)
 */
const MAX_IMAGES_PER_PROPERTY = parseInt(process.env.MAX_IMAGES_PER_PROPERTY) || Infinity;
const MAX_VIDEOS_PER_PROPERTY = parseInt(process.env.MAX_VIDEOS_PER_PROPERTY) || Infinity;

// ── Resolve absolute upload root once, from __dirname ─────────
// This is the key fix: using path.resolve(__dirname, ...) rather than
// reading process.env.UPLOAD_DIR as a relative string, which diverges
// when the process is started from a parent directory (e.g. npm start
// run from the project root instead of the backend/ directory).
//
// backend/src/config/multer.js  →  __dirname = .../backend/src/config
// → go up two levels           →  .../backend
// → append subdir              →  .../backend/uploads/<subFolder>
const UPLOAD_ROOT = path.resolve(__dirname, '..', '..', 'uploads');

// ── Storage engine factory ─────────────────────────────────────
function diskStorage(subFolder) {
  const dest = path.join(UPLOAD_ROOT, subFolder);

  // Guarantee the destination directory exists before multer tries to write.
  //
  // WHY THIS IS NEEDED:
  // multer.diskStorage() with a custom destination *function* does NOT create
  // the directory automatically — that only happens when you pass a plain
  // string via the `dest:` option.  On a fresh clone, after moving the project
  // folder, or on any deployment where the uploads/ subdirectories were not
  // pre-created, multer throws:
  //   ENOENT: no such file or directory, open '…/uploads/properties/<uuid>.jpg'
  // Creating the directory eagerly at module-load time (before any request
  // arrives) means the error can never happen at upload time.
  fs.mkdirSync(dest, { recursive: true });

  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dest),
    filename:    (_req, file,  cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4()}${ext}`);
    },
  });
}

// ── File filters ───────────────────────────────────────────────

const IMAGE_EXT_RE  = /^(jpeg|jpg|png|webp)$/;
const IMAGE_MIME_RE = /^image\/(jpeg|png|webp)$/;

const imageFilter = (_req, file, cb) => {
  const ext  = IMAGE_EXT_RE.test(path.extname(file.originalname).toLowerCase().slice(1));
  const mime = IMAGE_MIME_RE.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
};

const VIDEO_EXT_RE  = /^(mp4|webm)$/;
const VIDEO_MIME_RE = /^video\/(mp4|webm)$/;

const videoFilter = (_req, file, cb) => {
  const ext  = VIDEO_EXT_RE.test(path.extname(file.originalname).toLowerCase().slice(1));
  const mime = VIDEO_MIME_RE.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only MP4 and WebM videos are allowed'));
};

const DOC_EXT_RE  = /^(pdf|doc|docx)$/;
const DOC_MIME_RE = /^(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;

const documentFilter = (_req, file, cb) => {
  const ext  = DOC_EXT_RE.test(path.extname(file.originalname).toLowerCase().slice(1));
  const mime = DOC_MIME_RE.test(file.mimetype);
  if (ext && mime) return cb(null, true);
  cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
};

// ── Upload instances ───────────────────────────────────────────

const uploadPropertyImage = multer({
  storage:    diskStorage('properties'),
  limits:     { fileSize: MAX_SIZE_BYTES },    // no files: cap — count enforced in controller
  fileFilter: imageFilter,
});

const uploadPropertyVideo = multer({
  storage:    diskStorage('videos'),
  limits:     { fileSize: MAX_VIDEO_SIZE_BYTES }, // no files: cap — count enforced in controller
  fileFilter: videoFilter,
});

const uploadDocument = multer({
  storage:    diskStorage('documents'),
  limits:     { fileSize: MAX_SIZE_BYTES, files: 1 },
  fileFilter: documentFilter,
});

const uploadAvatar = multer({
  storage:    diskStorage('avatars'),
  limits:     { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: imageFilter,
});

module.exports = {
  uploadPropertyImage,
  uploadPropertyVideo,
  uploadDocument,
  uploadAvatar,
  UPLOAD_ROOT,                   // exported so controllers can use the same root
  MAX_IMAGES_PER_PROPERTY,
  MAX_VIDEOS_PER_PROPERTY,
  // Byte limits exported so errorHandler can produce accurate error messages
  MAX_SIZE_BYTES,
  MAX_VIDEO_SIZE_BYTES,
};
