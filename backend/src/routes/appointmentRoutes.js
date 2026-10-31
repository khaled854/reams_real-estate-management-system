'use strict';

const { Router }     = require('express');
const controller     = require('../controllers/appointmentController');
const authenticate   = require('../middleware/authenticate');
const authorize      = require('../middleware/authorize');
const validate       = require('../middleware/validate');
const {
  createPublicSchema,
  createAdminSchema,
  updateSchema,
  updateStatusSchema,
  rescheduleSchema,
  assignSchema,
} = require('../validators/appointmentValidator');

const router = Router();

/* ─────────────────────────────────────────────────────────────
   PUBLIC endpoint — no authentication
   POST /api/v1/appointments/public
   Allows website visitors to book a property viewing.
   Protected only by the global rate limiter (200 req / 15 min).
   ───────────────────────────────────────────────────────────── */
router.post(
  '/public',
  validate(createPublicSchema),
  controller.createPublic
);

/* ─────────────────────────────────────────────────────────────
   All remaining routes require authentication
   ───────────────────────────────────────────────────────────── */
router.use(authenticate);

/* ── GET /api/v1/appointments/stats ─────────────────────── */
router.get('/stats', controller.getStats);

/* ── GET /api/v1/appointments/property/:propertyId ───────── */
router.get('/property/:propertyId', controller.getByProperty);

/* ── GET /api/v1/appointments/customer/:customerId ───────── */
router.get('/customer/:customerId', controller.getByCustomer);

/* ── GET /api/v1/appointments ────────────────────────────── */
router.get('/', controller.getAll);

/* ── POST /api/v1/appointments ───────────────────────────── */
router.post(
  '/',
  authorize('admin', 'manager', 'employee'),
  validate(createAdminSchema),
  controller.create
);

/* ── GET /api/v1/appointments/:id ────────────────────────── */
router.get('/:id', controller.getOne);

/* ── PUT /api/v1/appointments/:id ────────────────────────── */
router.put(
  '/:id',
  authorize('admin', 'manager', 'employee'),
  validate(updateSchema),
  controller.update
);

/* ── PATCH /api/v1/appointments/:id/status ───────────────── */
router.patch(
  '/:id/status',
  authorize('admin', 'manager', 'employee'),
  validate(updateStatusSchema),
  controller.updateStatus
);

/* ── PATCH /api/v1/appointments/:id/reschedule ───────────── */
router.patch(
  '/:id/reschedule',
  authorize('admin', 'manager', 'employee'),
  validate(rescheduleSchema),
  controller.reschedule
);

/* ── PATCH /api/v1/appointments/:id/assign ───────────────── */
router.patch(
  '/:id/assign',
  authorize('admin', 'manager'),
  validate(assignSchema),
  controller.assign
);

/* ── DELETE /api/v1/appointments/:id ─────────────────────── */
router.delete(
  '/:id',
  authorize('admin', 'manager'),
  controller.remove
);

module.exports = router;
