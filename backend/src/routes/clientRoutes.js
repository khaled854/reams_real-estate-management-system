'use strict';

/**
 * clientRoutes.js
 * Client / owner management routes — to be implemented in the Clients module.
 */

const { Router } = require('express');

const router = Router();

router.all('*', (_req, res) => {
  res.status(501).json({ success: false, message: 'Clients module not yet implemented' });
});

module.exports = router;
