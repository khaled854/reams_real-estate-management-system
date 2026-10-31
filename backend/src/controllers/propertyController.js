'use strict';

const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');

const propertyModel = require('../models/propertyModel');
const AppError      = require('../utils/AppError');
const asyncHandler  = require('../utils/asyncHandler');
const { logActivity } = require('../utils/activityLogger');
const { MAX_IMAGES_PER_PROPERTY, MAX_VIDEOS_PER_PROPERTY, UPLOAD_ROOT } = require('../config/multer');
const {
  sendSuccess,
  sendCreated,
  buildPaginationMeta,
} = require('../utils/response');

/**
 * Safely resolve a stored relative path against the uploads root.
 * Guards against path traversal (e.g. stored value "../../etc/passwd").
 *
 * @param {string} relativePath — e.g. "properties/abc.jpg"
 * @returns {string|null} — absolute path, or null if traversal detected
 */
function safeUploadPath(relativePath) {
  if (!relativePath) return null;
  const resolved = path.resolve(UPLOAD_ROOT, relativePath);
  // Must start with UPLOAD_ROOT — reject anything that escapes
  if (!resolved.startsWith(UPLOAD_ROOT + path.sep) && resolved !== UPLOAD_ROOT) {
    return null;
  }
  return resolved;
}

/* ── GET /api/v1/properties ───────────────────────────────── */
const getAll = asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);

  const { rows, total } = await propertyModel.findAll({
    status:       req.query.status       || undefined,
    listing_type: req.query.listing_type || undefined,
    type_id:      req.query.type_id      ? parseInt(req.query.type_id) : undefined,
    location:     req.query.location     || undefined,
    min_price:    req.query.min_price    ? parseFloat(req.query.min_price) : undefined,
    max_price:    req.query.max_price    ? parseFloat(req.query.max_price) : undefined,
    agent_id:     req.query.agent_id     ? parseInt(req.query.agent_id) : undefined,
    is_featured:  req.query.is_featured !== undefined
                    ? req.query.is_featured === 'true'
                    : undefined,
    search:       req.query.search       || undefined,
    sort:         req.query.sort         || 'created_at',
    order:        req.query.order        || 'DESC',
    page,
    limit,
  });

  sendSuccess(res, {
    data: rows,
    meta: buildPaginationMeta(total, page, limit),
  });
});

/* ── GET /api/v1/properties/types ─────────────────────────── */
const getTypes = asyncHandler(async (_req, res) => {
  const types = await propertyModel.getPropertyTypes();
  sendSuccess(res, { data: types });
});

/* ── GET /api/v1/properties/:id ───────────────────────────── */
const getOne = asyncHandler(async (req, res) => {
  const property = await propertyModel.findById(req.params.id);
  if (!property) throw new AppError('Property not found', 404);

  const [images, videos] = await Promise.all([
    propertyModel.getImages(property.id),
    propertyModel.getVideos(property.id),
  ]);
  sendSuccess(res, { data: { ...property, images, videos } });
});

/* ── POST /api/v1/properties ──────────────────────────────── */
const create = asyncHandler(async (req, res) => {
  // Employees can only create properties assigned to themselves
  // Managers and admins can specify any agent
  let agentId = req.body.agent_id || null;
  if (req.user.role === 'employee') agentId = req.user.id;

  const property = await propertyModel.create({
    ...req.body,
    uuid:     uuidv4(),
    agent_id: agentId,
  });

  await logActivity(req, {
    action:      'property.created',
    description: `Property created: ${property.title}`,
    entity_type: 'properties',
    entity_id:   property.id,
    new_values:  property,
  });

  sendCreated(res, { message: 'Property created successfully', data: property });
});

/* ── PUT /api/v1/properties/:id ───────────────────────────── */
const update = asyncHandler(async (req, res) => {
  const existing = await propertyModel.findById(req.params.id);
  if (!existing) throw new AppError('Property not found', 404);

  // Employees may only edit their own listings; managers and admins can edit any
  if (req.user.role === 'employee' && existing.agent_id !== req.user.id) {
    throw new AppError('You can only edit properties assigned to you', 403);
  }

  const updated = await propertyModel.update(req.params.id, req.body);

  await logActivity(req, {
    action:      'property.updated',
    description: `Property updated: ${updated.title}`,
    entity_type: 'properties',
    entity_id:   updated.id,
    old_values:  existing,
    new_values:  updated,
  });

  sendSuccess(res, { message: 'Property updated successfully', data: updated });
});

/* ── PATCH /api/v1/properties/:id/status ─────────────────── */
const updateStatus = asyncHandler(async (req, res) => {
  const existing = await propertyModel.findById(req.params.id);
  if (!existing) throw new AppError('Property not found', 404);

  if (req.user.role === 'employee' && existing.agent_id !== req.user.id) {
    throw new AppError('You can only update status of your own properties', 403);
  }

  const updated = await propertyModel.updateStatus(req.params.id, req.body.status);

  await logActivity(req, {
    action:      'property.status_changed',
    description: `Property status changed: "${existing.title}" → ${req.body.status}`,
    entity_type: 'properties',
    entity_id:   existing.id,
    old_values:  { status: existing.status },
    new_values:  { status: req.body.status },
  });

  sendSuccess(res, { message: 'Status updated successfully', data: updated });
});

/* ── DELETE /api/v1/properties/:id ───────────────────────── */
const remove = asyncHandler(async (req, res) => {
  const existing = await propertyModel.findById(req.params.id);
  if (!existing) throw new AppError('Property not found', 404);

  if (req.user.role === 'employee' && existing.agent_id !== req.user.id) {
    throw new AppError('You can only delete your own properties', 403);
  }

  // Collect video paths before the CASCADE delete removes the DB rows
  const videos = await propertyModel.getVideos(existing.id);

  await propertyModel.remove(req.params.id);

  // Delete physical video files on property removal (non-fatal if missing)
  for (const v of videos) {
    try {
      const filePath = safeUploadPath(v.video_path);
      if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch { /* ignore */ }
  }

  await logActivity(req, {
    action:      'property.deleted',
    description: `Property deleted: ${existing.title}`,
    entity_type: 'properties',
    entity_id:   existing.id,
    old_values:  existing,
  });

  sendSuccess(res, { message: 'Property deleted successfully' });
});

/* ── GET /api/v1/properties/:id/images ───────────────────── */
const getImages = asyncHandler(async (req, res) => {
  const property = await propertyModel.findById(req.params.id);
  if (!property) throw new AppError('Property not found', 404);

  const images = await propertyModel.getImages(property.id);
  sendSuccess(res, { data: images });
});

/* ── POST /api/v1/properties/:id/images ──────────────────── */
const uploadImages = asyncHandler(async (req, res) => {
  const property = await propertyModel.findById(req.params.id);
  if (!property) throw new AppError('Property not found', 404);

  if (req.user.role === 'employee' && property.agent_id !== req.user.id) {
    throw new AppError('You can only upload images to your own properties', 403);
  }

  if (!req.files || req.files.length === 0) {
    throw new AppError('No images uploaded', 400);
  }

  const existingImages = await propertyModel.getImages(property.id);

  // Enforce per-property image cap only if a finite limit is configured
  if (isFinite(MAX_IMAGES_PER_PROPERTY)) {
    const slotsRemaining = MAX_IMAGES_PER_PROPERTY - existingImages.length;
    if (slotsRemaining <= 0) {
      throw new AppError(`Property already has the maximum of ${MAX_IMAGES_PER_PROPERTY} images`, 400);
    }
    if (req.files.length > slotsRemaining) {
      throw new AppError(
        `Only ${slotsRemaining} more image${slotsRemaining !== 1 ? 's' : ''} can be added (maximum ${MAX_IMAGES_PER_PROPERTY} per property)`,
        400
      );
    }
  }

  const isCoverNeeded = existingImages.length === 0;
  const saved = [];

  for (let i = 0; i < req.files.length; i++) {
    const file = req.files[i];
    const relativePath = path.join('properties', file.filename).replace(/\\/g, '/');

    const image = await propertyModel.addImage({
      property_id: property.id,
      image_path:  relativePath,
      is_cover:    isCoverNeeded && i === 0,
      sort_order:  existingImages.length + i,
      file_size:   file.size,
      mime_type:   file.mimetype,
    });
    saved.push(image);
  }

  await logActivity(req, {
    action:      'property.images_uploaded',
    description: `${saved.length} image(s) uploaded for property: ${property.title}`,
    entity_type: 'properties',
    entity_id:   property.id,
  });

  sendCreated(res, { message: `${saved.length} image(s) uploaded`, data: saved });
});

/* ── DELETE /api/v1/properties/:id/images/:imageId ───────── */
const deleteImage = asyncHandler(async (req, res) => {
  const property = await propertyModel.findById(req.params.id);
  if (!property) throw new AppError('Property not found', 404);

  if (req.user.role === 'employee' && property.agent_id !== req.user.id) {
    throw new AppError('You can only delete images from your own properties', 403);
  }

  const deleted = await propertyModel.removeImage(req.params.imageId, property.id);
  if (!deleted) throw new AppError('Image not found', 404);

  // Delete physical image file (non-fatal if missing, rejected if traversal attempt)
  try {
    const filePath = safeUploadPath(deleted.image_path);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore FS errors */ }

  await logActivity(req, {
    action:      'property.image_deleted',
    description: `Image deleted from property: ${property.title}`,
    entity_type: 'properties',
    entity_id:   property.id,
  });

  sendSuccess(res, { message: 'Image deleted successfully' });
});

/* ── GET /api/v1/properties/:id/videos ───────────────────── */
const getVideos = asyncHandler(async (req, res) => {
  const property = await propertyModel.findById(req.params.id);
  if (!property) throw new AppError('Property not found', 404);

  const videos = await propertyModel.getVideos(property.id);
  sendSuccess(res, { data: videos });
});

/* ── POST /api/v1/properties/:id/videos ──────────────────── */
const uploadVideos = asyncHandler(async (req, res) => {
  const property = await propertyModel.findById(req.params.id);
  if (!property) throw new AppError('Property not found', 404);

  if (req.user.role === 'employee' && property.agent_id !== req.user.id) {
    throw new AppError('You can only upload videos to your own properties', 403);
  }

  if (!req.files || req.files.length === 0) {
    throw new AppError('No videos uploaded', 400);
  }

  const existingVideos = await propertyModel.getVideos(property.id);

  // Enforce per-property video cap only if a finite limit is configured
  if (isFinite(MAX_VIDEOS_PER_PROPERTY)) {
    const slotsRemaining = MAX_VIDEOS_PER_PROPERTY - existingVideos.length;
    if (slotsRemaining <= 0) {
      throw new AppError(`Property already has the maximum of ${MAX_VIDEOS_PER_PROPERTY} videos`, 400);
    }
    if (req.files.length > slotsRemaining) {
      throw new AppError(
        `Only ${slotsRemaining} more video${slotsRemaining !== 1 ? 's' : ''} can be added (maximum ${MAX_VIDEOS_PER_PROPERTY} per property)`,
        400
      );
    }
  }

  const saved = [];
  for (let i = 0; i < req.files.length; i++) {
    const file         = req.files[i];
    const relativePath = path.join('videos', file.filename).replace(/\\/g, '/');
    const title        = path.basename(file.originalname, path.extname(file.originalname)) || null;

    const video = await propertyModel.addVideo({
      property_id: property.id,
      video_path:  relativePath,
      title,
      sort_order:  existingVideos.length + i,
      file_size:   file.size,
      mime_type:   file.mimetype,
    });
    saved.push(video);
  }

  await logActivity(req, {
    action:      'property.videos_uploaded',
    description: `${saved.length} video(s) uploaded for property: ${property.title}`,
    entity_type: 'properties',
    entity_id:   property.id,
  });

  sendCreated(res, { message: `${saved.length} video(s) uploaded`, data: saved });
});

/* ── DELETE /api/v1/properties/:id/videos/:videoId ───────── */
const deleteVideo = asyncHandler(async (req, res) => {
  const property = await propertyModel.findById(req.params.id);
  if (!property) throw new AppError('Property not found', 404);

  if (req.user.role === 'employee' && property.agent_id !== req.user.id) {
    throw new AppError('You can only delete videos from your own properties', 403);
  }

  const deleted = await propertyModel.removeVideo(req.params.videoId, property.id);
  if (!deleted) throw new AppError('Video not found', 404);

  // Delete physical video file (non-fatal if missing, rejected if traversal attempt)
  try {
    const filePath = safeUploadPath(deleted.video_path);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch { /* ignore FS errors */ }

  await logActivity(req, {
    action:      'property.video_deleted',
    description: `Video deleted from property: ${property.title}`,
    entity_type: 'properties',
    entity_id:   property.id,
  });

  sendSuccess(res, { message: 'Video deleted successfully' });
});

module.exports = {
  getAll, getTypes, getOne, create, update, updateStatus, remove,
  getImages, uploadImages, deleteImage,
  getVideos, uploadVideos, deleteVideo,
};
