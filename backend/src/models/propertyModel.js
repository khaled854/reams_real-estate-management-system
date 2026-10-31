'use strict';

/**
 * propertyModel.js
 * All SQL queries for the `properties`, `property_images`, and
 * `property_videos` tables.
 *
 * Column-presence detection
 * ─────────────────────────
 * Migration 009 adds lat, lng, show_exact_location to the properties table.
 * If a database was created before migration 009 was run, those columns do
 * not exist and any INSERT that names them throws:
 *   ER_BAD_FIELD_ERROR: Unknown column 'lat' in 'field list'
 *
 * Rather than crash the whole server, we probe once at startup and build
 * the INSERT statement dynamically, omitting columns that don't exist yet.
 * Once the operator runs `node scripts/migrate-live-db.js` (or migration 009)
 * and restarts the server, the probe picks up the new columns automatically.
 */

const { pool } = require('../config/database');

// ── One-time schema probe ──────────────────────────────────────
// Resolved to { hasLat: bool, hasLng: bool, hasShowExact: bool } after the
// first successful DB query.  Null means "not yet resolved".
let _columnCache = null;

async function _getOptionalColumns() {
  if (_columnCache !== null) return _columnCache;

  try {
    const [rows] = await pool.execute(
      `SELECT COLUMN_NAME
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME   = 'properties'
         AND COLUMN_NAME  IN ('lat', 'lng', 'show_exact_location')`
    );
    const names = new Set(rows.map((r) => r.COLUMN_NAME));
    _columnCache = {
      hasLat:       names.has('lat'),
      hasLng:       names.has('lng'),
      hasShowExact: names.has('show_exact_location'),
    };
  } catch {
    // If information_schema is unavailable (rare), assume columns are absent
    // so we degrade gracefully rather than throwing.
    _columnCache = { hasLat: false, hasLng: false, hasShowExact: false };
  }

  return _columnCache;
}

/** Reset the cache — called by tests or after running a migration. */
function _resetColumnCache() { _columnCache = null; }

/* ── Helpers ──────────────────────────────────────────────── */
const BASE_SELECT = `
  SELECT
    p.*,
    pt.name                                AS type_name,
    CONCAT(u.first_name, ' ', u.last_name) AS agent_name,
    u.phone                                AS agent_phone,
    COUNT(DISTINCT pi.id)                                    AS image_count,
    MAX(CASE WHEN pi.is_cover = 1 THEN pi.image_path END)   AS cover_image
  FROM properties p
  LEFT JOIN property_types  pt ON pt.id  = p.type_id
  LEFT JOIN users            u  ON u.id   = p.agent_id
  LEFT JOIN property_images pi  ON pi.property_id = p.id
`;
const GROUP_BY = 'GROUP BY p.id';

/* ── Property queries ─────────────────────────────────────── */

async function findById(id) {
  const [rows] = await pool.execute(
    `${BASE_SELECT} WHERE p.id = ? ${GROUP_BY} LIMIT 1`, [id]
  );
  return rows[0] || null;
}

async function findByUuid(uuid) {
  const [rows] = await pool.execute(
    `${BASE_SELECT} WHERE p.uuid = ? ${GROUP_BY} LIMIT 1`, [uuid]
  );
  return rows[0] || null;
}

async function findAll({
  status, listing_type, type_id, location, min_price, max_price,
  agent_id, is_featured, search,
  page = 1, limit = 20, sort = 'created_at', order = 'DESC',
} = {}) {
  const offset = (page - 1) * limit;
  const conditions = [];
  const params = [];

  if (status)       { conditions.push('p.status = ?');       params.push(status); }
  if (listing_type) { conditions.push('p.listing_type = ?'); params.push(listing_type); }
  if (type_id)      { conditions.push('p.type_id = ?');      params.push(type_id); }
  if (location)     { conditions.push('p.location LIKE ?');  params.push(`%${location}%`); }
  if (min_price)    { conditions.push('p.price >= ?');        params.push(min_price); }
  if (max_price)    { conditions.push('p.price <= ?');        params.push(max_price); }
  if (agent_id)     { conditions.push('p.agent_id = ?');     params.push(agent_id); }
  if (is_featured !== undefined) {
    conditions.push('p.is_featured = ?');
    params.push(is_featured ? 1 : 0);
  }
  if (search) {
    conditions.push('(p.title LIKE ? OR p.location LIKE ? OR p.owner_name LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeSort  = ['created_at','price','area','title'].includes(sort) ? sort : 'created_at';
  const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const [[{ total }]] = await pool.execute(
    `SELECT COUNT(DISTINCT p.id) AS total FROM properties p ${where}`,
    params
  );

  const [rows] = await pool.execute(
    `${BASE_SELECT} ${where} ${GROUP_BY} ORDER BY p.${safeSort} ${safeOrder} LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  return { rows, total };
}

async function create({
  uuid, type_id, type, title, description, location, address,
  area, rooms, bedrooms, bathrooms, floor,
  price, payment_method, owner_name, owner_phone,
  listing_type, status, is_featured, agent_id,
  lat, lng, show_exact_location,
}) {
  // Probe once which optional geo-columns exist (added by migration 009).
  // If they are absent we simply omit them from the INSERT so the server
  // keeps working on databases that haven't had migration 009 applied yet.
  const { hasLat, hasLng, hasShowExact } = await _getOptionalColumns();

  // ── Build column list and values dynamically ───────────────
  const cols   = [
    'uuid','type_id','type','title','description','location','address',
    'area','rooms','bedrooms','bathrooms','floor',
    'price','payment_method','owner_name','owner_phone',
    'listing_type','status','is_featured','agent_id',
  ];
  const values = [
    uuid, type_id, type, title, description || null, location, address,
    area, rooms || null, bedrooms || null, bathrooms || null, floor || null,
    price, payment_method || 'cash', owner_name, owner_phone,
    listing_type || 'sale', status || 'available', is_featured ? 1 : 0, agent_id || null,
  ];

  if (hasLat) {
    cols.push('lat');
    values.push(lat != null ? parseFloat(lat) : null);
  }
  if (hasLng) {
    cols.push('lng');
    values.push(lng != null ? parseFloat(lng) : null);
  }
  if (hasShowExact) {
    cols.push('show_exact_location');
    values.push(show_exact_location ? 1 : 0);
  }

  const placeholders = cols.map(() => '?').join(',');
  const [result] = await pool.execute(
    `INSERT INTO properties (${cols.join(',')}) VALUES (${placeholders})`,
    values
  );
  return findById(result.insertId);
}

async function update(id, fields) {
  // Probe which optional geo-columns exist (same logic as create).
  const { hasLat, hasLng, hasShowExact } = await _getOptionalColumns();

  const allowed = [
    'type_id','type','title','description','location','address',
    'area','rooms','bedrooms','bathrooms','floor',
    'price','payment_method','owner_name','owner_phone',
    'listing_type','status','is_featured','agent_id',
    // Geo columns — only include if the DB column actually exists
    ...(hasLat       ? ['lat']                 : []),
    ...(hasLng       ? ['lng']                 : []),
    ...(hasShowExact ? ['show_exact_location'] : []),
  ];
  const setClauses = [];
  const params = [];

  for (const key of allowed) {
    if (fields[key] !== undefined) {
      setClauses.push(`${key} = ?`);
      // Coerce lat/lng to float or null; show_exact_location to 0/1
      if (key === 'lat' || key === 'lng') {
        params.push(fields[key] != null ? parseFloat(fields[key]) : null);
      } else if (key === 'show_exact_location') {
        params.push(fields[key] ? 1 : 0);
      } else {
        params.push(fields[key]);
      }
    }
  }
  if (setClauses.length === 0) return findById(id);

  params.push(id);
  await pool.execute(
    `UPDATE properties SET ${setClauses.join(', ')} WHERE id = ?`, params
  );
  return findById(id);
}

async function updateStatus(id, status) {
  await pool.execute('UPDATE properties SET status = ? WHERE id = ?', [status, id]);
  return findById(id);
}

async function remove(id) {
  await pool.execute('DELETE FROM properties WHERE id = ?', [id]);
}

/* ── Property image queries ───────────────────────────────── */

async function getImages(propertyId) {
  const [rows] = await pool.execute(
    'SELECT * FROM property_images WHERE property_id = ? ORDER BY sort_order ASC, id ASC',
    [propertyId]
  );
  return rows;
}

async function addImage({ property_id, image_path, is_cover, sort_order, file_size, mime_type }) {
  const [result] = await pool.execute(
    `INSERT INTO property_images (property_id, image_path, is_cover, sort_order, file_size, mime_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [property_id, image_path, is_cover ? 1 : 0, sort_order || 0, file_size || null, mime_type || null]
  );
  const [rows] = await pool.execute(
    'SELECT * FROM property_images WHERE id = ?', [result.insertId]
  );
  return rows[0];
}

async function removeImage(imageId, propertyId) {
  const [rows] = await pool.execute(
    'SELECT * FROM property_images WHERE id = ? AND property_id = ?',
    [imageId, propertyId]
  );
  if (!rows[0]) return null;
  await pool.execute('DELETE FROM property_images WHERE id = ?', [imageId]);
  return rows[0];
}

async function getPropertyTypes() {
  const [rows] = await pool.execute(
    'SELECT * FROM property_types WHERE is_active = 1 ORDER BY name ASC'
  );
  return rows;
}

/* ── Property video queries ───────────────────────────────── */

/** Fetch all videos for a property, ordered by sort_order. */
async function getVideos(propertyId) {
  const [rows] = await pool.execute(
    'SELECT * FROM property_videos WHERE property_id = ? ORDER BY sort_order ASC, id ASC',
    [propertyId]
  );
  return rows;
}

/**
 * Add a single video record.
 * @param {{ property_id, video_path, title, sort_order, file_size, mime_type }} opts
 */
async function addVideo({ property_id, video_path, title, sort_order, file_size, mime_type }) {
  const [result] = await pool.execute(
    `INSERT INTO property_videos (property_id, video_path, title, sort_order, file_size, mime_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [property_id, video_path, title || null, sort_order || 0, file_size || null, mime_type || null]
  );
  const [rows] = await pool.execute(
    'SELECT * FROM property_videos WHERE id = ?', [result.insertId]
  );
  return rows[0];
}

/**
 * Remove a single video record.
 * Returns the deleted row (so the controller can delete the file from disk),
 * or null if not found.
 */
async function removeVideo(videoId, propertyId) {
  const [rows] = await pool.execute(
    'SELECT * FROM property_videos WHERE id = ? AND property_id = ?',
    [videoId, propertyId]
  );
  if (!rows[0]) return null;
  await pool.execute('DELETE FROM property_videos WHERE id = ?', [videoId]);
  return rows[0];
}

module.exports = {
  findById, findByUuid, findAll,
  create, update, updateStatus, remove,
  getImages, addImage, removeImage,
  getVideos, addVideo, removeVideo,
  getPropertyTypes,
  _resetColumnCache,  // exported for tests / post-migration cache invalidation
};
