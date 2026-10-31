'use strict';

const { Router }   = require('express');
const controller   = require('../controllers/propertyController');
const authenticate = require('../middleware/authenticate');
const authorize    = require('../middleware/authorize');
const validate     = require('../middleware/validate');
const { uploadPropertyImage, uploadPropertyVideo } = require('../config/multer');
const {
  createPropertySchema,
  updatePropertySchema,
  updateStatusSchema,
} = require('../validators/propertyValidator');

const router = Router();

// All property routes require authentication
router.use(authenticate);

/**
 * @route  GET /api/v1/properties/types
 * @desc   Get all active property types (for dropdowns)
 * @access Private
 */
router.get('/types', controller.getTypes);

/**
 * @route  GET /api/v1/properties
 * @desc   List properties with filters and pagination
 * @query  status, listing_type, type_id, location, min_price, max_price,
 *         agent_id, is_featured, search, page, limit, sort, order
 * @access Private
 */
router.get('/', controller.getAll);

/**
 * @route  POST /api/v1/properties
 * @desc   Create a new property listing
 * @access Admin | Employee
 */
router.post(
  '/',
  authorize('admin', 'manager', 'employee'),
  validate(createPropertySchema),
  controller.create
);

/**
 * @route  GET /api/v1/properties/:id
 * @desc   Get a single property with all images
 * @access Private
 */
router.get('/:id', controller.getOne);

/**
 * @route  PUT /api/v1/properties/:id
 * @desc   Update a property (employees: own only)
 * @access Admin | Employee
 */
router.put(
  '/:id',
  authorize('admin', 'manager', 'employee'),
  validate(updatePropertySchema),
  controller.update
);

/**
 * @route  PATCH /api/v1/properties/:id/status
 * @desc   Update listing status only
 * @access Admin | Manager | Employee
 */
router.patch(
  '/:id/status',
  authorize('admin', 'manager', 'employee'),
  validate(updateStatusSchema),
  controller.updateStatus
);

/**
 * @route  DELETE /api/v1/properties/:id
 * @desc   Delete a property and all its images (CASCADE)
 * @access Admin | Manager | Employee (own only)
 */
router.delete(
  '/:id',
  authorize('admin', 'manager', 'employee'),
  controller.remove
);

/**
 * @route  GET /api/v1/properties/:id/images
 * @desc   Get all images for a property
 * @access Private
 */
router.get('/:id/images', controller.getImages);

/**
 * @route  POST /api/v1/properties/:id/images
 * @desc   Upload one or more images (multipart/form-data, field: images)
 *         Accepts JPEG, PNG, WebP · Max 10 MB per file · No fixed count limit
 *         (set MAX_IMAGES_PER_PROPERTY env var to cap, default = unlimited)
 * @access Admin | Employee (own only)
 */
router.post(
  '/:id/images',
  authorize('admin', 'manager', 'employee'),
  uploadPropertyImage.array('images'),   // no second arg = no multer-level count cap
  controller.uploadImages
);

/**
 * @route  DELETE /api/v1/properties/:id/images/:imageId
 * @desc   Delete a single property image
 * @access Admin | Manager | Employee (own only)
 */
router.delete(
  '/:id/images/:imageId',
  authorize('admin', 'manager', 'employee'),
  controller.deleteImage
);

/* ── Video routes ─────────────────────────────────────────── */

/**
 * @route  GET /api/v1/properties/:id/videos
 * @desc   Get all videos for a property
 * @access Private
 */
router.get('/:id/videos', controller.getVideos);

/**
 * @route  POST /api/v1/properties/:id/videos
 * @desc   Upload one or more videos (multipart/form-data, field: videos)
 *         Accepts MP4 and WebM · Max 1 GB per file · No fixed count limit
 *         (set MAX_VIDEOS_PER_PROPERTY env var to cap, default = unlimited)
 * @access Admin | Manager | Employee (own only)
 */
router.post(
  '/:id/videos',
  authorize('admin', 'manager', 'employee'),
  uploadPropertyVideo.array('videos'),   // no second arg = no multer-level count cap
  controller.uploadVideos
);

/**
 * @route  DELETE /api/v1/properties/:id/videos/:videoId
 * @desc   Delete a single property video
 * @access Admin | Manager | Employee (own only)
 */
router.delete(
  '/:id/videos/:videoId',
  authorize('admin', 'manager', 'employee'),
  controller.deleteVideo
);

module.exports = router;
