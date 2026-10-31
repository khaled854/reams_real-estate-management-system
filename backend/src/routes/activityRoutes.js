'use strict';

const { Router }   = require('express');
const authenticate = require('../middleware/authenticate');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, buildPaginationMeta } = require('../utils/response');
const { pool }     = require('../config/database');

const router = Router();
router.use(authenticate);

/**
 * @route  GET /api/v1/activities
 * @desc   Paginated activity log (most recent first)
 * @query  page, limit, entity_type, entity_id, action
 * @access Private — employees see only their own; admins see all
 */
router.get('/', asyncHandler(async (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;

  const conditions = [];
  const params     = [];

  // Employees see only their own activity; admins and managers see all
  if (req.user.role === 'employee') {
    conditions.push('a.user_id = ?');
    params.push(req.user.id);
  }

  if (req.query.entity_type) { conditions.push('a.entity_type = ?'); params.push(req.query.entity_type); }
  if (req.query.entity_id)   { conditions.push('a.entity_id = ?');   params.push(parseInt(req.query.entity_id)); }
  if (req.query.action)      { conditions.push('a.action LIKE ?');    params.push(`%${req.query.action}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM activities a ${where}`, params
  );

  const [rows] = await pool.execute(
    `SELECT a.id, a.action, a.description, a.entity_type, a.entity_id,
            a.ip_address, a.created_at,
            CONCAT_WS(' ', u.first_name, u.last_name) AS user_name
     FROM activities a
     LEFT JOIN users u ON u.id = a.user_id
     ${where}
     ORDER BY a.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  sendSuccess(res, {
    data: rows,
    meta: buildPaginationMeta(Number(total), page, limit),
  });
}));

module.exports = router;
