'use strict';

/**
 * routes/index.js
 * Master API router — mounts all feature routers under /api/v1
 */

const { Router } = require('express');

const router = Router();
const v1     = Router();

router.use('/v1', v1);

// ── API status (public, no auth) ─────────────────────────────
v1.get('/status', (_req, res) => {
  res.json({
    success:   true,
    message:   'REMS API v1 is operational',
    version:   '1.0.0',
    timestamp: new Date().toISOString(),
    // NOTE: environment is intentionally omitted — do not expose NODE_ENV publicly
  });
});

// ── Feature routers ──────────────────────────────────────────
v1.use('/auth',         require('./authRoutes'));
v1.use('/users',        require('./userRoutes'));
v1.use('/properties',   require('./propertyRoutes'));
v1.use('/customers',    require('./customerRoutes'));
v1.use('/appointments', require('./appointmentRoutes'));
v1.use('/reports',      require('./reportRoutes'));
v1.use('/activities',   require('./activityRoutes'));

module.exports = router;
