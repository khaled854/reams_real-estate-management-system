'use strict';

/**
 * contractRoutes.js
 * Contract & lease routes — to be implemented in the Contracts module.
 */

const { Router } = require('express');

const router = Router();

router.all('*', (_req, res) => {
  res.status(501).json({ success: false, message: 'Contracts module not yet implemented' });
});

module.exports = router;
