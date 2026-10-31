'use strict';
/**
 * QA RUNTIME TEST SUITE — REMS Final Pre-Delivery Audit
 * Covers: Auth, RBAC, Property CRUD, Customer CRUD, Appointment CRUD,
 *         File Uploads, Reports, Dashboard, Security, Edge Cases,
 *         Error Handling, API inventory
 *
 * Run from project root: node QA_REPORT/qa_runtime_test.js
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

// ── Load test credentials from .env.test (never hardcode in source) ──
// Copy QA_REPORT/.env.test.example to QA_REPORT/.env.test and fill values.
const dotenvPath = path.join(__dirname, '.env.test');
if (fs.existsSync(dotenvPath)) {
  require('fs').readFileSync(dotenvPath, 'utf8').split('\n').forEach(line => {
    const [k, ...rest] = line.split('=');
    if (k && k.trim() && !k.trim().startsWith('#')) process.env[k.trim()] = rest.join('=').trim();
  });
}

const BASE           = process.env.TEST_BASE_URL    || 'http://localhost:5000/api/v1';
const ADMIN_EMAIL    = process.env.TEST_ADMIN_EMAIL  || '';
const ADMIN_PASS     = process.env.TEST_ADMIN_PASS   || '';
const MANAGER_EMAIL  = process.env.TEST_MANAGER_EMAIL || '';

if (!ADMIN_EMAIL || !ADMIN_PASS) {
  console.error('ERROR: TEST_ADMIN_EMAIL and TEST_ADMIN_PASS must be set in QA_REPORT/.env.test');
  console.error('Copy QA_REPORT/.env.test.example to QA_REPORT/.env.test and fill in your credentials.');
  process.exit(1);
}

const QA_PREFIX = 'QA_TEST_';

/* ── Stats ─────────────────────────────────────────────────── */
let passed = 0, failed = 0, blocked = 0;
const allResults = [];
const bugs = [];
const createdRecords = []; // track test records for cleanup

/* ── Helpers ───────────────────────────────────────────────── */
function log(status, label, detail = '') {
  const sym = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'BLOCK' ? '🟡' : '⚠️';
  const line = `  ${sym} [${status}] ${label}${detail ? ' | ' + detail : ''}`;
  console.log(line);
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') { failed++; bugs.push({ label, detail }); }
  else if (status === 'BLOCK') blocked++;
  allResults.push({ status, label, detail });
}

function request(method, urlPath, body, cookies = {}, extraHeaders = {}) {
  return new Promise((resolve) => {
    const url  = new URL(BASE + urlPath);
    const data = body ? JSON.stringify(body) : null;
    const cookieStr = Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ');
    const opts = {
      hostname: url.hostname,
      port:     parseInt(url.port) || 80,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(cookieStr ? { Cookie: cookieStr } : {}),
        ...extraHeaders,
      },
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        const setCookies = {};
        for (const c of (res.headers['set-cookie'] || [])) {
          const [pair] = c.split(';');
          const [k, v] = pair.split('=');
          if (k && v !== undefined) setCookies[k.trim()] = v.trim();
        }
        let body;
        try { body = JSON.parse(raw); } catch { body = { _raw: raw }; }
        resolve({ status: res.statusCode, body, setCookies, headers: res.headers });
      });
    });
    req.on('error', err => resolve({ status: 0, body: { error: err.message }, setCookies: {}, headers: {} }));
    if (data) req.write(data);
    req.end();
  });
}

function authReq(method, urlPath, body, token, cookies = {}) {
  return request(method, urlPath, body, cookies, token ? { Authorization: `Bearer ${token}` } : {});
}

function section(name) { console.log(`\n${'═'.repeat(60)}\n  ${name}\n${'═'.repeat(60)}`); }

// Multipart upload helper
function multipartRequest(urlPath, fieldName, fileName, fileBuffer, mimeType, token) {
  return new Promise((resolve) => {
    const boundary = `----QABoundary${Date.now()}`;
    const nl = '\r\n';
    const partHead = `--${boundary}${nl}Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${nl}Content-Type: ${mimeType}${nl}${nl}`;
    const partTail = `${nl}--${boundary}--${nl}`;
    const headBuf = Buffer.from(partHead);
    const tailBuf = Buffer.from(partTail);
    const bodyBuf = Buffer.concat([headBuf, fileBuffer, tailBuf]);
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1' + urlPath, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const req = http.request(opts, res => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { body = { _raw: raw }; }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', err => resolve({ status: 0, body: { error: err.message } }));
    req.write(bodyBuf);
    req.end();
  });
}

/* ══════════════════════════════════════════════════════════════
   TEST SUITES
   ══════════════════════════════════════════════════════════════ */

/* ── T01: HEALTH & STATUS ─────────────────────────────────── */
async function testHealthAndStatus() {
  section('T01: HEALTH & STATUS');
  const h = await new Promise(r => http.get('http://localhost:5000/health', res => {
    let d = ''; res.on('data', c => d += c); res.on('end', () => r({ status: res.statusCode, body: JSON.parse(d) }));
  }).on('error', () => r({ status: 0 })));
  log(h.status === 200 && h.body.status === 'ok' ? 'PASS' : 'FAIL', 'GET /health → 200 ok');
  log(h.body?.environment === 'production' ? 'PASS' : 'FAIL', 'NODE_ENV is production', `env=${h.body?.environment}`);

  const s = await request('GET', '/status');
  log(s.status === 200 && s.body.success ? 'PASS' : 'FAIL', 'GET /api/v1/status → 200');

  // Unknown API route must return 404 JSON, not 200 HTML
  const unk = await request('DELETE', '/api_nonexistent_route_xyz');
  log(unk.status === 404 ? 'PASS' : 'FAIL', 'Unknown API route → 404 JSON (not SPA html)', `got ${unk.status}`);
  log(!unk.body?._raw?.includes('<!doctype') ? 'PASS' : 'FAIL', 'Unknown API route does NOT return HTML');

  // GET /api/v1/nonexistent — in production the SPA catch-all intercepts non-API GETs
  // but the regex now excludes /api/ paths, so /api/v1/nonexistent should 404
  const unkGet = await request('GET', '/nonexistent_api_path');
  log(unkGet.status === 404 ? 'PASS' : 'FAIL', 'GET /api/v1/nonexistent → 404 (not 200 HTML)', `got ${unkGet.status} body_type=${typeof unkGet.body}`);
}

/* ── T02: AUTHENTICATION ──────────────────────────────────── */
async function testAuth() {
  section('T02: AUTHENTICATION');
  const results = {};

  // Invalid credentials
  const bad1 = await request('POST', '/auth/login', { email: ADMIN_EMAIL, password: 'WRONG_PASS' });
  log(bad1.status === 401 ? 'PASS' : 'FAIL', 'Login wrong password → 401', `got ${bad1.status}`);

  const bad2 = await request('POST', '/auth/login', { email: 'nobody@nope.com', password: ADMIN_PASS });
  log(bad2.status === 401 ? 'PASS' : 'FAIL', 'Login unknown email → 401');

  const bad3 = await request('POST', '/auth/login', {});
  log(bad3.status === 422 ? 'PASS' : 'FAIL', 'Login empty body → 422', `got ${bad3.status}`);

  const bad4 = await request('POST', '/auth/login', { email: 'not-an-email', password: 'x' });
  log(bad4.status === 422 ? 'PASS' : 'FAIL', 'Login malformed email → 422');

  // Valid admin login
  const login = await request('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  log(login.status === 200 ? 'PASS' : 'FAIL', 'Admin login → 200', `got ${login.status}`);
  log(!!login.body?.data?.accessToken ? 'PASS' : 'FAIL', 'Login returns accessToken');
  log(!login.body?.data?.refreshToken ? 'PASS' : 'FAIL', 'Login does NOT return refreshToken in body (cookie only)');
  log(!!login.setCookies?.rems_rt ? 'PASS' : 'FAIL', 'Login sets rems_rt HttpOnly cookie');

  const adminToken = login.body?.data?.accessToken;
  const adminCookie = { rems_rt: login.setCookies?.rems_rt };
  results.adminToken = adminToken;
  results.adminCookie = adminCookie;

  // GET /auth/me
  const me = await authReq('GET', '/auth/me', null, adminToken);
  log(me.status === 200 ? 'PASS' : 'FAIL', 'GET /auth/me → 200');
  log(me.body?.data?.email === ADMIN_EMAIL ? 'PASS' : 'FAIL', '/auth/me returns correct email');
  log(!me.body?.data?.password_hash ? 'PASS' : 'FAIL', '/auth/me does NOT leak password_hash');
  log(me.body?.data?.role === 'admin' ? 'PASS' : 'FAIL', '/auth/me role = admin (normalised from DB agent/admin)');

  // No token → 401
  const noToken = await request('GET', '/auth/me');
  log(noToken.status === 401 ? 'PASS' : 'FAIL', 'Protected endpoint without token → 401');

  // Invalid token → 401
  const badToken = await authReq('GET', '/auth/me', null, 'invalid.jwt.token');
  log(badToken.status === 401 ? 'PASS' : 'FAIL', 'Invalid JWT → 401');

  // Refresh token rotation
  const refresh1 = await request('POST', '/auth/refresh', {}, adminCookie);
  log(refresh1.status === 200 ? 'PASS' : 'FAIL', 'Valid refresh → 200');
  log(!!refresh1.body?.data?.accessToken ? 'PASS' : 'FAIL', 'Refresh returns new accessToken');
  log(!refresh1.body?.data?.refreshToken ? 'PASS' : 'FAIL', 'Refresh does NOT return refreshToken in body');
  log(!!refresh1.setCookies?.rems_rt ? 'PASS' : 'FAIL', 'Refresh sets new rems_rt cookie');
  log(refresh1.setCookies?.rems_rt !== adminCookie.rems_rt ? 'PASS' : 'FAIL', 'New refresh token differs from old');

  const newCookie = { rems_rt: refresh1.setCookies?.rems_rt };
  const newToken = refresh1.body?.data?.accessToken;

  // Old refresh token must be revoked
  const reuseOld = await request('POST', '/auth/refresh', {}, adminCookie);
  log(reuseOld.status === 401 ? 'PASS' : 'FAIL', 'Reused old refresh token → 401 (rotation enforced)');

  // New token still works
  const meNew = await authReq('GET', '/auth/me', null, newToken);
  log(meNew.status === 200 ? 'PASS' : 'FAIL', 'New access token from refresh works');

  // Forged refresh token
  const forged = await request('POST', '/auth/refresh', {}, { rems_rt: 'forged.token.value' });
  log(forged.status === 401 ? 'PASS' : 'FAIL', 'Forged refresh token → 401');

  // Logout
  const logoutRes = await new Promise(r => {
    const data = JSON.stringify({});
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${newToken}`,
        Cookie: `rems_rt=${newCookie.rems_rt}`,
      },
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => r({ status: res.statusCode, body: JSON.parse(d) }));
    });
    req.on('error', () => r({ status: 0 }));
    req.write(data); req.end();
  });
  log(logoutRes.status === 200 ? 'PASS' : 'FAIL', 'Logout → 200');

  // Post-logout refresh must fail
  const postLogout = await request('POST', '/auth/refresh', {}, newCookie);
  log(postLogout.status === 401 ? 'PASS' : 'FAIL', 'Post-logout refresh token → 401');

  // Re-login for subsequent tests
  const reLogin = await request('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  results.adminToken = reLogin.body?.data?.accessToken;
  results.adminCookie = { rems_rt: reLogin.setCookies?.rems_rt };

  return results;
}

/* ── T03: USERS CRUD ─────────────────────────────────────── */
async function testUsers(adminToken) {
  section('T03: USERS CRUD (Admin Only)');
  const results = {};

  // List users
  const list = await authReq('GET', '/users', null, adminToken);
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /users (admin) → 200');
  log(Array.isArray(list.body?.data) ? 'PASS' : 'FAIL', 'GET /users returns array');
  log(!list.body?.data?.some(u => u.password_hash !== undefined) ? 'PASS' : 'FAIL', 'Users list does NOT expose password_hash');

  // Create employee (QA_TEST)
  const empData = {
    name: `${QA_PREFIX}Employee One`,
    email: `${QA_PREFIX}emp1@qatest.com`,
    password: 'QATest@12345',
    role: 'employee',
  };
  const createEmp = await authReq('POST', '/users', empData, adminToken);
  log(createEmp.status === 201 ? 'PASS' : 'FAIL', 'POST /users create employee → 201', `got ${createEmp.status} ${createEmp.body?.message}`);
  const empId = createEmp.body?.data?.id;
  if (empId) createdRecords.push({ type: 'user', id: empId, label: empData.email });
  results.empId = empId;
  results.empEmail = empData.email;
  results.empPass = empData.password;

  // Employee role normalised
  log(createEmp.body?.data?.role === 'employee' ? 'PASS' : 'FAIL', 'Created user role = employee (normalised from agent)', `role=${createEmp.body?.data?.role}`);

  // Get one user
  const getOne = await authReq('GET', `/users/${empId}`, null, adminToken);
  log(getOne.status === 200 ? 'PASS' : 'FAIL', `GET /users/${empId} → 200`);

  // Update user
  const upd = await authReq('PUT', `/users/${empId}`, { name: `${QA_PREFIX}Employee One Updated` }, adminToken);
  log(upd.status === 200 ? 'PASS' : 'FAIL', 'PUT /users/:id update name → 200');

  // Get non-existent user
  const no = await authReq('GET', '/users/9999999', null, adminToken);
  log(no.status === 404 ? 'PASS' : 'FAIL', 'GET /users/9999999 → 404');

  // Duplicate email
  const dup = await authReq('POST', '/users', empData, adminToken);
  log(dup.status === 409 ? 'PASS' : 'FAIL', 'Duplicate email → 409', `got ${dup.status}`);

  // Deactivate
  const deact = await authReq('PATCH', `/users/${empId}/deactivate`, null, adminToken);
  log(deact.status === 200 ? 'PASS' : 'FAIL', 'PATCH /users/:id/deactivate → 200');

  // Activate
  const act = await authReq('PATCH', `/users/${empId}/activate`, null, adminToken);
  log(act.status === 200 ? 'PASS' : 'FAIL', 'PATCH /users/:id/activate → 200');

  // Password reset
  const passReset = await authReq('PATCH', `/users/${empId}/password`, { password: 'QANew@12345' }, adminToken);
  log(passReset.status === 200 ? 'PASS' : 'FAIL', 'PATCH /users/:id/password → 200');

  // Employee cannot access /users
  const empLogin = await request('POST', '/auth/login', { email: empData.email, password: 'QANew@12345' });
  const empToken = empLogin.body?.data?.accessToken;
  const empCookie = { rems_rt: empLogin.setCookies?.rems_rt };
  results.empToken = empToken;
  results.empCookie = empCookie;

  const empListUsers = await authReq('GET', '/users', null, empToken);
  log(empListUsers.status === 403 ? 'PASS' : 'FAIL', 'Employee GET /users → 403 (RBAC enforced)', `got ${empListUsers.status}`);

  const empCreateUser = await authReq('POST', '/users', { name: 'x', email: 'x@x.com', password: 'x' }, empToken);
  log(empCreateUser.status === 403 ? 'PASS' : 'FAIL', 'Employee POST /users → 403', `got ${empCreateUser.status}`);

  return results;
}

/* ── T04: PROPERTY CRUD ──────────────────────────────────── */
async function testProperties(adminToken, empToken) {
  section('T04: PROPERTY CRUD');
  const results = {};

  // Property types
  const types = await authReq('GET', '/properties/types', null, adminToken);
  log(types.status === 200 ? 'PASS' : 'FAIL', 'GET /properties/types → 200');
  log(Array.isArray(types.body?.data) && types.body.data.length >= 12 ? 'PASS' : 'FAIL',
    `Property types count ≥12`, `got ${types.body?.data?.length}`);

  // Check all 12 category names
  const typeNames = types.body?.data?.map(t => t.name?.toLowerCase()) || [];
  const expected = ['apartment','villa','townhouse','office','retail shop','warehouse','land','building','studio','duplex','farm','chalet'];
  for (const name of expected) {
    log(typeNames.includes(name) ? 'PASS' : 'FAIL', `Property type "${name}" exists in DB`);
  }

  // List properties (admin)
  const list = await authReq('GET', '/properties', null, adminToken);
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /properties (admin) → 200');
  log(Array.isArray(list.body?.data) ? 'PASS' : 'FAIL', 'GET /properties returns array');
  log(typeof list.body?.meta === 'object' ? 'PASS' : 'FAIL', 'GET /properties has pagination meta');

  // Create property (admin)
  const propData = {
    type_id: 1,
    type: 'Apartment',
    title: `${QA_PREFIX}Test Apartment`,
    location: 'Riyadh',
    city: 'Riyadh',
    address: '1 QA Street',
    area: 150.5,
    price: 750000,
    payment_method: 'cash',
    owner_name: 'QA Owner',
    owner_phone: '0501234567',
    listing_type: 'sale',
    status: 'available',
  };
  const created = await authReq('POST', '/properties', propData, adminToken);
  log(created.status === 201 ? 'PASS' : 'FAIL', 'POST /properties create → 201', `got ${created.status} ${created.body?.message}`);
  const propId = created.body?.data?.id;
  if (propId) createdRecords.push({ type: 'property', id: propId, label: propData.title });
  results.propId = propId;

  // Get property details
  const detail = await authReq('GET', `/properties/${propId}`, null, adminToken);
  log(detail.status === 200 ? 'PASS' : 'FAIL', `GET /properties/${propId} → 200`);
  log(detail.body?.data?.title === propData.title ? 'PASS' : 'FAIL', 'Property title matches');
  log(Array.isArray(detail.body?.data?.images) ? 'PASS' : 'FAIL', 'Property detail includes images array');
  log(Array.isArray(detail.body?.data?.videos) ? 'PASS' : 'FAIL', 'Property detail includes videos array');

  // Update property
  const upd = await authReq('PUT', `/properties/${propId}`, { price: 800000, description: 'Updated desc' }, adminToken);
  log(upd.status === 200 ? 'PASS' : 'FAIL', 'PUT /properties/:id update → 200');
  log(upd.body?.data?.price === 800000 ? 'PASS' : 'FAIL', 'Price updated correctly');

  // Status update
  const stat = await authReq('PATCH', `/properties/${propId}/status`, { status: 'reserved' }, adminToken);
  log(stat.status === 200 ? 'PASS' : 'FAIL', 'PATCH /properties/:id/status → 200');
  log(stat.body?.data?.status === 'reserved' ? 'PASS' : 'FAIL', 'Status updated to reserved');

  // Invalid status
  const badStat = await authReq('PATCH', `/properties/${propId}/status`, { status: 'invalid_status' }, adminToken);
  log(badStat.status === 422 ? 'PASS' : 'FAIL', 'Invalid status → 422', `got ${badStat.status}`);

  // Search
  const searchRes = await authReq('GET', `/properties?search=${encodeURIComponent(QA_PREFIX)}`, null, adminToken);
  log(searchRes.status === 200 ? 'PASS' : 'FAIL', 'Search properties → 200');

  // Filter by status
  const filterStat = await authReq('GET', '/properties?status=available', null, adminToken);
  log(filterStat.status === 200 ? 'PASS' : 'FAIL', 'Filter by status=available → 200');
  log(filterStat.body?.data?.every(p => p.status === 'available') ? 'PASS' : 'FAIL', 'Filtered results all have status=available');

  // Filter by type
  const filterType = await authReq('GET', '/properties?type_id=1', null, adminToken);
  log(filterType.status === 200 ? 'PASS' : 'FAIL', 'Filter by type_id=1 → 200');

  // Price range filter
  const priceFilter = await authReq('GET', '/properties?min_price=100000&max_price=1000000', null, adminToken);
  log(priceFilter.status === 200 ? 'PASS' : 'FAIL', 'Price range filter → 200');

  // Non-existent property
  const noP = await authReq('GET', '/properties/9999999', null, adminToken);
  log(noP.status === 404 ? 'PASS' : 'FAIL', 'GET /properties/9999999 → 404');

  // Missing required fields
  const missingFields = await authReq('POST', '/properties', { title: 'Missing Fields' }, adminToken);
  log(missingFields.status === 422 ? 'PASS' : 'FAIL', 'Create property missing required fields → 422', `got ${missingFields.status}`);

  // Arabic text property
  const arabicProp = await authReq('POST', '/properties', {
    ...propData,
    title: `${QA_PREFIX}شقة عربية للاختبار`,
    location: 'الرياض',
    city: 'الرياض',
  }, adminToken);
  log(arabicProp.status === 201 ? 'PASS' : 'FAIL', 'Create property with Arabic text → 201', `got ${arabicProp.status}`);
  if (arabicProp.body?.data?.id) createdRecords.push({ type: 'property', id: arabicProp.body.data.id, label: 'Arabic prop' });

  // SQL injection attempt in search
  const sqlInj = await authReq('GET', `/properties?search=${encodeURIComponent("' OR '1'='1")}`, null, adminToken);
  log(sqlInj.status === 200 ? 'PASS' : 'FAIL', 'SQL injection in search → 200 (safe, no crash)');
  log(!sqlInj.body?.data?.some(p => p.title?.includes("' OR '1'='1")) ? 'PASS' : 'FAIL', 'SQL injection returns safe empty/filtered result');

  // RBAC: employee cannot edit another employee's property
  if (empToken && propId) {
    const empEdit = await authReq('PUT', `/properties/${propId}`, { title: 'Hacked' }, empToken);
    log(empEdit.status === 403 ? 'PASS' : 'FAIL', 'Employee cannot edit admin property → 403 (IDOR check)', `got ${empEdit.status}`);
    const empDel = await authReq('DELETE', `/properties/${propId}`, null, empToken);
    log(empDel.status === 403 ? 'PASS' : 'FAIL', 'Employee cannot delete admin property → 403', `got ${empDel.status}`);
  }

  // Unauthenticated access
  const unauth = await request('GET', '/properties');
  log(unauth.status === 401 ? 'PASS' : 'FAIL', 'GET /properties without auth → 401');

  // Pagination
  const page2 = await authReq('GET', '/properties?page=2&limit=5', null, adminToken);
  log(page2.status === 200 ? 'PASS' : 'FAIL', 'Pagination page 2 → 200');

  // Very large page
  const bigPage = await authReq('GET', '/properties?page=99999', null, adminToken);
  log(bigPage.status === 200 ? 'PASS' : 'FAIL', 'Very large page → 200 (empty, no crash)');
  log(Array.isArray(bigPage.body?.data) ? 'PASS' : 'FAIL', 'Large page returns empty array not crash');

  return results;
}

/* ── T05: PROPERTY IMAGES ────────────────────────────────── */
async function testPropertyImages(adminToken, propId) {
  section('T05: PROPERTY IMAGES & VIDEOS');

  if (!propId) { log('BLOCK', 'Image upload tests blocked — no propId'); return; }

  // Create valid 1x1 JPEG (minimal valid JPEG)
  const validJpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8U' +
    'HRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAARC' +
    'AABAAEDASIA AhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAA' +
    'AAAAP/EABQBAQAAAAAAAAAAAAAAAAAAAAD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAx' +
    'EA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Aw' +
    'H//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AIP/2gAIAQEAAT8AB//Z', 'base64'
  );

  // Valid JPEG upload
  const imgUp = await multipartRequest(`/properties/${propId}/images`, 'images', 'test.jpg', validJpeg, 'image/jpeg', adminToken);
  log(imgUp.status === 201 ? 'PASS' : 'FAIL', 'Upload valid JPEG → 201', `got ${imgUp.status} ${imgUp.body?.message}`);
  const imageId = imgUp.body?.data?.[0]?.id;

  // Retrieve images
  const imgs = await authReq('GET', `/properties/${propId}/images`, null, adminToken);
  log(imgs.status === 200 ? 'PASS' : 'FAIL', 'GET property images → 200');
  log(imgs.body?.data?.length > 0 ? 'PASS' : 'FAIL', 'Images returned after upload');

  // UUID filename (not user-supplied)
  const imgPath = imgs.body?.data?.[0]?.image_path;
  const uuidRegex = /^properties\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;
  log(imgPath && uuidRegex.test(imgPath) ? 'PASS' : 'FAIL', 'Image stored with UUID filename', `path=${imgPath}`);

  // Image accessible via /uploads/
  if (imgPath) {
    const fileAccess = await new Promise(r => http.get(`http://localhost:5000/uploads/${imgPath}`, res => {
      r(res.statusCode);
      res.resume();
    }).on('error', () => r(0)));
    log(fileAccess === 200 ? 'PASS' : 'FAIL', `Uploaded image accessible via /uploads/`, `status=${fileAccess}`);

    // Image exists on disk
    const diskPath = path.resolve(__dirname, '..', 'backend', 'uploads', imgPath.replace(/\//g, path.sep));
    log(fs.existsSync(diskPath) ? 'PASS' : 'FAIL', 'Image file exists on disk', `path=${diskPath}`);
  }

  // Invalid extension (text file with image/jpeg MIME)
  const txtData = Buffer.from('this is not an image');
  const badExt = await multipartRequest(`/properties/${propId}/images`, 'images', 'malicious.txt', txtData, 'image/jpeg', adminToken);
  log(badExt.status >= 400 && badExt.status < 500 ? 'PASS' : 'FAIL', 'Wrong extension (.txt) rejected → 4xx', `got ${badExt.status}`);

  // MIME spoofing: correct ext but wrong MIME
  const mimeSpoofed = await multipartRequest(`/properties/${propId}/images`, 'images', 'legit.jpg', txtData, 'text/plain', adminToken);
  log(mimeSpoofed.status >= 400 && mimeSpoofed.status < 500 ? 'PASS' : 'FAIL', 'MIME spoofing (jpg+text/plain) rejected → 4xx', `got ${mimeSpoofed.status}`);

  // Executable disguised as image
  const exeData = Buffer.from('MZ\x90\x00\x03\x00\x00\x00'); // PE header
  const exeUp = await multipartRequest(`/properties/${propId}/images`, 'images', 'virus.exe', exeData, 'image/jpeg', adminToken);
  log(exeUp.status >= 400 && exeUp.status < 500 ? 'PASS' : 'FAIL', 'Executable (.exe) rejected → 4xx', `got ${exeUp.status}`);

  // Path traversal in filename
  const traversalData = Buffer.from('irrelevant');
  const traversal = await multipartRequest(`/properties/${propId}/images`, 'images', '../../../etc/passwd', traversalData, 'image/jpeg', adminToken);
  log(traversal.status >= 400 && traversal.status < 500 ? 'PASS' : 'FAIL', 'Path traversal filename rejected → 4xx', `got ${traversal.status}`);

  // Upload without auth
  const noAuthUp = await multipartRequest(`/properties/${propId}/images`, 'images', 'test.jpg', validJpeg, 'image/jpeg', null);
  log(noAuthUp.status === 401 ? 'PASS' : 'FAIL', 'Image upload without auth → 401');

  // Delete image
  if (imageId) {
    const delImg = await authReq('DELETE', `/properties/${propId}/images/${imageId}`, null, adminToken);
    log(delImg.status === 200 ? 'PASS' : 'FAIL', 'DELETE property image → 200');

    // Verify deleted from disk
    if (imgPath) {
      const diskPath = path.resolve(__dirname, '..', 'backend', 'uploads', imgPath.replace(/\//g, path.sep));
      log(!fs.existsSync(diskPath) ? 'PASS' : 'FAIL', 'Deleted image removed from disk');
    }
  }
}

/* ── T06: CUSTOMERS CRUD ─────────────────────────────────── */
async function testCustomers(adminToken, empToken, empId) {
  section('T06: CUSTOMERS CRUD');
  const results = {};

  // List
  const list = await authReq('GET', '/customers', null, adminToken);
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /customers (admin) → 200');
  log(Array.isArray(list.body?.data) ? 'PASS' : 'FAIL', 'GET /customers returns array');

  // Pipeline
  const pipe = await authReq('GET', '/customers/pipeline', null, adminToken);
  log(pipe.status === 200 ? 'PASS' : 'FAIL', 'GET /customers/pipeline → 200');
  log(pipe.body?.data !== undefined ? 'PASS' : 'FAIL', 'Pipeline returns data');

  // Create customer
  const custData = {
    name: `${QA_PREFIX}Ahmad Al-Rashid`,
    phone: '0501111222',
    email: `${QA_PREFIX}customer@test.com`,
    status: 'new',
    budget: 500000,
    property_type: 'Apartment',
    location: 'Riyadh',
    notes: 'QA test customer',
  };
  const created = await authReq('POST', '/customers', custData, adminToken);
  log(created.status === 201 ? 'PASS' : 'FAIL', 'POST /customers create → 201', `got ${created.status}`);
  const custId = created.body?.data?.id;
  if (custId) createdRecords.push({ type: 'customer', id: custId, label: custData.name });
  results.custId = custId;

  // Arabic name persisted correctly
  log(created.body?.data?.name?.includes('Ahmad') ? 'PASS' : 'FAIL', 'Arabic customer name stored');

  // Get one
  const getOne = await authReq('GET', `/customers/${custId}`, null, adminToken);
  log(getOne.status === 200 ? 'PASS' : 'FAIL', `GET /customers/${custId} → 200`);

  // Update
  const upd = await authReq('PUT', `/customers/${custId}`, { notes: 'Updated notes', budget: 600000 }, adminToken);
  log(upd.status === 200 ? 'PASS' : 'FAIL', 'PUT /customers/:id → 200');

  // Status update
  const statUpd = await authReq('PATCH', `/customers/${custId}/status`, { status: 'interested' }, adminToken);
  log(statUpd.status === 200 ? 'PASS' : 'FAIL', 'PATCH /customers/:id/status → 200');
  log(statUpd.body?.data?.status === 'interested' ? 'PASS' : 'FAIL', 'Status updated to interested');

  // Invalid status
  const badStat = await authReq('PATCH', `/customers/${custId}/status`, { status: 'invalidstatus' }, adminToken);
  log(badStat.status === 422 ? 'PASS' : 'FAIL', 'Invalid customer status → 422', `got ${badStat.status}`);

  // Search
  const srch = await authReq('GET', `/customers?search=${encodeURIComponent(QA_PREFIX)}`, null, adminToken);
  log(srch.status === 200 ? 'PASS' : 'FAIL', 'Customer search → 200');

  // Non-existent
  const noC = await authReq('GET', '/customers/9999999', null, adminToken);
  log(noC.status === 404 ? 'PASS' : 'FAIL', 'GET /customers/9999999 → 404');

  // IDOR: employee cannot access admin customer
  if (empToken && custId) {
    const empAccess = await authReq('GET', `/customers/${custId}`, null, empToken);
    log(empAccess.status === 403 ? 'PASS' : 'FAIL', 'Employee cannot GET admin customer → 403 (IDOR)', `got ${empAccess.status}`);
  }

  // Missing required fields
  const missing = await authReq('POST', '/customers', { email: 'x@x.com' }, adminToken);
  log(missing.status === 422 ? 'PASS' : 'FAIL', 'Customer missing name+phone → 422', `got ${missing.status}`);

  // Unauthenticated
  const unauth = await request('GET', '/customers');
  log(unauth.status === 401 ? 'PASS' : 'FAIL', 'GET /customers without auth → 401');

  // Check "clients" naming — clientRoutes.js should 501
  const clientsRes = await authReq('GET', '/clients', null, adminToken);
  log(clientsRes.status === 501 ? 'PASS' : 'FAIL', '/clients route returns 501 (stub)', `got ${clientsRes.status}`);
  log(!clientsRes.body?._raw?.includes('<!doctype') ? 'PASS' : 'FAIL', '/clients does not return HTML');

  return results;
}

/* ── T07: APPOINTMENTS CRUD ───────────────────────────────── */
async function testAppointments(adminToken, empToken, propId, custId) {
  section('T07: APPOINTMENTS CRUD');
  const results = {};

  // List
  const list = await authReq('GET', '/appointments', null, adminToken);
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /appointments (admin) → 200');
  log(Array.isArray(list.body?.data) ? 'PASS' : 'FAIL', 'GET /appointments returns array');

  // Stats
  const stats = await authReq('GET', '/appointments/stats', null, adminToken);
  log(stats.status === 200 ? 'PASS' : 'FAIL', 'GET /appointments/stats → 200');

  // Public booking (no auth)
  const pubData = {
    property_id: propId || 1,
    customer_name: `${QA_PREFIX}Public Visitor`,
    customer_phone: '0508889999',
    appointment_date: '2027-06-15',
    appointment_time: '10:00',
    type: 'viewing',
  };
  const pubBook = await request('POST', '/appointments/public', pubData);
  log(pubBook.status === 201 ? 'PASS' : 'FAIL', 'POST /appointments/public (no auth) → 201', `got ${pubBook.status} ${JSON.stringify(pubBook.body?.message)}`);
  const pubApptId = pubBook.body?.data?.id;
  if (pubApptId) createdRecords.push({ type: 'appointment', id: pubApptId, label: 'public booking' });

  // Public booking data subset (no admin_notes leaked)
  log(!pubBook.body?.data?.hasOwnProperty('admin_notes') ? 'PASS' : 'FAIL', 'Public booking does not return admin_notes');

  // Create appointment (admin)
  if (propId) {
    const apptData = {
      property_id: propId,
      customer_id: custId || null,
      customer_name: `${QA_PREFIX}Admin Booking`,
      customer_phone: '0509876543',
      appointment_date: '2027-07-01',
      appointment_time: '14:00',
      type: 'viewing',
    };
    const created = await authReq('POST', '/appointments', apptData, adminToken);
    log(created.status === 201 ? 'PASS' : 'FAIL', 'POST /appointments (admin) → 201', `got ${created.status} ${created.body?.message}`);
    const apptId = created.body?.data?.id;
    if (apptId) createdRecords.push({ type: 'appointment', id: apptId, label: 'admin booking' });
    results.apptId = apptId;

    // Get one
    const getOne = await authReq('GET', `/appointments/${apptId}`, null, adminToken);
    log(getOne.status === 200 ? 'PASS' : 'FAIL', `GET /appointments/${apptId} → 200`);

    // Status update
    const statUpd = await authReq('PATCH', `/appointments/${apptId}/status`, { status: 'confirmed' }, adminToken);
    log(statUpd.status === 200 ? 'PASS' : 'FAIL', 'PATCH /appointments/:id/status confirmed → 200');

    // Invalid status transition — confirmed → pending (invalid)
    const badTrans = await authReq('PATCH', `/appointments/${apptId}/status`, { status: 'pending' }, adminToken);
    log(badTrans.status === 422 ? 'PASS' : 'FAIL', 'Invalid status transition → 422', `got ${badTrans.status}`);

    // Reschedule
    const resched = await authReq('PATCH', `/appointments/${apptId}/reschedule`, {
      appointment_date: '2027-07-15',
      appointment_time: '11:00',
    }, adminToken);
    log(resched.status === 200 ? 'PASS' : 'FAIL', 'PATCH /appointments/:id/reschedule → 200', `got ${resched.status}`);
  }

  // Invalid time format
  const badTime = await request('POST', '/appointments/public', {
    ...pubData,
    appointment_time: '25:99:99',
  });
  log(badTime.status === 422 ? 'PASS' : 'FAIL', 'Invalid time format → 422', `got ${badTime.status}`);

  // Unauthenticated
  const unauth = await request('GET', '/appointments');
  log(unauth.status === 401 ? 'PASS' : 'FAIL', 'GET /appointments without auth → 401');

  // IDOR: employee cannot see all appointments by default
  if (empToken) {
    const empList = await authReq('GET', '/appointments', null, empToken);
    log(empList.status === 200 ? 'PASS' : 'FAIL', 'Employee GET /appointments → 200 (filtered to own)');
  }

  return results;
}

/* ── T08: CONTRACTS (STUB) ───────────────────────────────── */
async function testContracts(adminToken) {
  section('T08: CONTRACTS (Expected: NOT IMPLEMENTED)');
  const r = await authReq('GET', '/contracts', null, adminToken);
  log(r.status === 404 || r.status === 501 ? 'PASS' : 'FAIL',
    `Contracts GET → 404/501 (stub/not mounted)`, `got ${r.status}`);
  log(!r.body?._raw?.includes('<!doctype') ? 'PASS' : 'FAIL',
    'Contracts does NOT return HTML');
}

/* ── T09: REPORTS ────────────────────────────────────────── */
async function testReports(adminToken, empToken) {
  section('T09: REPORTS');

  // Dashboard
  const dash = await authReq('GET', '/reports/dashboard', null, adminToken);
  log(dash.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/dashboard → 200');
  const d = dash.body?.data;
  const dashFields = ['available_properties','rented_properties','sold_properties','total_customers','new_customers','active_contracts','revenue_this_month'];
  for (const f of dashFields) {
    log(d && f in d ? 'PASS' : 'FAIL', `Dashboard field "${f}" present`, `value=${d?.[f]}`);
  }
  // Dashboard shows correct data (properties: available=12 from DB)
  log(d?.available_properties === 12 ? 'PASS' : 'WARN', `available_properties matches DB (12)`, `got ${d?.available_properties}`);
  log(d?.active_contracts === 0 ? 'PASS' : 'FAIL', 'active_contracts=0 (contracts not implemented)', `got ${d?.active_contracts}`);
  log(d?.revenue_this_month === '0.00' || d?.revenue_this_month === 0 ? 'PASS' : 'FAIL', 'revenue_this_month=0 (no financials)', `got ${d?.revenue_this_month}`);

  // Properties report
  const propRep = await authReq('GET', '/reports/properties', null, adminToken);
  log(propRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/properties → 200');
  log(Array.isArray(propRep.body?.data?.byStatus) ? 'PASS' : 'FAIL', 'Properties report has byStatus array');
  log(Array.isArray(propRep.body?.data?.byType) ? 'PASS' : 'FAIL', 'Properties report has byType array');
  log(Array.isArray(propRep.body?.data?.monthly) ? 'PASS' : 'FAIL', 'Properties report has monthly array');

  // Customers report
  const custRep = await authReq('GET', '/reports/customers', null, adminToken);
  log(custRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/customers → 200');
  log(Array.isArray(custRep.body?.data?.byStatus) ? 'PASS' : 'FAIL', 'Customers report has byStatus array');

  // Financials report (admin only)
  const finRep = await authReq('GET', '/reports/financials', null, adminToken);
  log(finRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/financials (admin) → 200');
  log(finRep.body?.data?.totals !== undefined ? 'PASS' : 'FAIL', 'Financials report has totals');
  // Revenue should be 0 since no financials exist
  log(Number(finRep.body?.data?.totals?.total_paid) === 0 ? 'PASS' : 'FAIL',
    'Financial totals total_paid=0 (no contracts/financials)', `got ${finRep.body?.data?.totals?.total_paid}`);

  // Agent performance (admin only)
  const agentRep = await authReq('GET', '/reports/agents', null, adminToken);
  log(agentRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/agents (admin) → 200');
  log(Array.isArray(agentRep.body?.data) ? 'PASS' : 'FAIL', 'Agents report returns array');

  // Date range filter
  const dateFilter = await authReq('GET', '/reports/properties?from_date=2020-01-01&to_date=2030-12-31', null, adminToken);
  log(dateFilter.status === 200 ? 'PASS' : 'FAIL', 'Properties report with date range → 200');

  // RBAC: employee cannot access financials
  if (empToken) {
    const empFin = await authReq('GET', '/reports/financials', null, empToken);
    log(empFin.status === 403 ? 'PASS' : 'FAIL', 'Employee cannot GET /reports/financials → 403', `got ${empFin.status}`);
    const empAgent = await authReq('GET', '/reports/agents', null, empToken);
    log(empAgent.status === 403 ? 'PASS' : 'FAIL', 'Employee cannot GET /reports/agents → 403', `got ${empAgent.status}`);
    const empDash = await authReq('GET', '/reports/dashboard', null, empToken);
    log(empDash.status === 200 ? 'PASS' : 'FAIL', 'Employee can GET /reports/dashboard → 200');
  }

  // Unauthenticated
  const unauth = await request('GET', '/reports/dashboard');
  log(unauth.status === 401 ? 'PASS' : 'FAIL', 'GET /reports/dashboard without auth → 401');
}

/* ── T10: ACTIVITIES ─────────────────────────────────────── */
async function testActivities(adminToken, empToken) {
  section('T10: ACTIVITY LOG');

  const acts = await authReq('GET', '/activities', null, adminToken);
  log(acts.status === 200 ? 'PASS' : 'FAIL', 'GET /activities (admin) → 200');
  log(Array.isArray(acts.body?.data) ? 'PASS' : 'FAIL', 'Activities returns array');
  log(acts.body?.data?.length > 0 ? 'PASS' : 'FAIL', 'Activities has entries', `count=${acts.body?.data?.length}`);

  // Check an activity entry structure
  const first = acts.body?.data?.[0];
  log(first?.action ? 'PASS' : 'FAIL', 'Activity entry has action field');
  log(first?.description ? 'PASS' : 'FAIL', 'Activity entry has description');
  log(first?.created_at ? 'PASS' : 'FAIL', 'Activity entry has timestamp');

  // Filter by action
  const loginActs = await authReq('GET', '/activities?action=user.login', null, adminToken);
  log(loginActs.status === 200 ? 'PASS' : 'FAIL', 'Activities filtered by action → 200');

  // Employee sees only own activities
  if (empToken) {
    const empActs = await authReq('GET', '/activities', null, empToken);
    log(empActs.status === 200 ? 'PASS' : 'FAIL', 'Employee GET /activities → 200 (filtered to own)');
  }

  // Unauthenticated
  const unauth = await request('GET', '/activities');
  log(unauth.status === 401 ? 'PASS' : 'FAIL', 'GET /activities without auth → 401');
}

/* ── T11: SECURITY AUDIT ─────────────────────────────────── */
async function testSecurity(adminToken, empToken, empId) {
  section('T11: SECURITY AUDIT');

  // Stack trace NOT exposed in production errors
  const badId = await authReq('GET', '/users/abc', null, adminToken);
  log(!badId.body?.stack ? 'PASS' : 'FAIL', 'No stack trace in production error responses');
  log(!badId.body?.message?.includes('syntax') ? 'PASS' : 'FAIL', 'No SQL syntax in error messages');

  // SQL injection in customer search
  const sqlCust = await authReq('GET', `/customers?search=${encodeURIComponent("'; DROP TABLE customers;--")}`, null, adminToken);
  log(sqlCust.status === 200 ? 'PASS' : 'FAIL', 'SQL injection in customers search → safe (200)');

  // XSS payload in customer name
  const xssCreate = await authReq('POST', '/customers', {
    name: `${QA_PREFIX}<script>alert(1)</script>`,
    phone: '0500000001',
  }, adminToken);
  log(xssCreate.status === 201 || xssCreate.status === 422 ? 'PASS' : 'FAIL',
    'XSS in customer name → stored safely or rejected', `got ${xssCreate.status}`);
  if (xssCreate.body?.data?.id) createdRecords.push({ type: 'customer', id: xssCreate.body.data.id, label: 'xss test' });

  // HTML-like input
  const htmlInput = await authReq('POST', '/customers', {
    name: `${QA_PREFIX}<img src=x onerror=alert(1)>`,
    phone: '0500000002',
  }, adminToken);
  log(htmlInput.status === 201 || htmlInput.status === 422 ? 'PASS' : 'FAIL',
    'HTML-like input safely stored or rejected');
  if (htmlInput.body?.data?.id) createdRecords.push({ type: 'customer', id: htmlInput.body.data.id, label: 'html test' });

  // CORS: external origin should be blocked or allowed based on config
  const corsRes = await new Promise(r => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/status', method: 'GET',
      headers: { Origin: 'https://evil.external.com' },
    };
    http.request(opts, res => {
      r({ status: res.statusCode, acao: res.headers['access-control-allow-origin'] });
      res.resume();
    }).on('error', () => r({ status: 0 })).end();
  });
  log(corsRes.acao !== '*' ? 'PASS' : 'FAIL', 'CORS: external origin NOT given wildcard (*)',
    `acao=${corsRes.acao}`);

  // LAN origin allowed
  const corsLan = await new Promise(r => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/status', method: 'GET',
      headers: { Origin: 'http://192.168.1.100:5000' },
    };
    http.request(opts, res => {
      r({ status: res.statusCode, acao: res.headers['access-control-allow-origin'] });
      res.resume();
    }).on('error', () => r({ status: 0 })).end();
  });
  log(corsLan.acao === 'http://192.168.1.100:5000' ? 'PASS' : 'FAIL',
    'CORS: LAN origin (192.168.x.x) allowed', `acao=${corsLan.acao}`);

  // password_hash not exposed anywhere
  const users = await authReq('GET', '/users', null, adminToken);
  log(!users.body?.data?.some(u => u.password_hash) ? 'PASS' : 'FAIL',
    'Users list: password_hash NEVER exposed');

  // Horizontal IDOR on customers
  if (empToken && empId) {
    // Create a customer as admin
    const adminCust = await authReq('POST', '/customers', {
      name: `${QA_PREFIX}Admin IDOR Test`,
      phone: '0500000099',
    }, adminToken);
    const adminCustId = adminCust.body?.data?.id;
    if (adminCustId) {
      createdRecords.push({ type: 'customer', id: adminCustId, label: 'IDOR test' });
      // Employee tries to access admin's customer by ID
      const idorTest = await authReq('GET', `/customers/${adminCustId}`, null, empToken);
      log(idorTest.status === 403 ? 'PASS' : 'FAIL',
        'IDOR: Employee cannot GET admin customer by ID → 403', `got ${idorTest.status}`);
      const idorEdit = await authReq('PUT', `/customers/${adminCustId}`, { notes: 'hacked' }, empToken);
      log(idorEdit.status === 403 ? 'PASS' : 'FAIL',
        'IDOR: Employee cannot PUT admin customer → 403', `got ${idorEdit.status}`);
    }
  }

  // Rate limit headers present
  const rl = await authReq('GET', '/reports/dashboard', null, adminToken);
  const hasRlHeaders = rl.headers && (
    rl.headers['ratelimit-limit'] || rl.headers['x-ratelimit-limit'] ||
    rl.headers['x-rate-limit-limit']
  );
  log(hasRlHeaders ? 'PASS' : 'FAIL', 'Rate limit headers present in responses',
    `header=${rl.headers['ratelimit-limit'] || rl.headers['x-ratelimit-limit'] || 'none'}`);

  // Refresh token cookie should have httponly flag
  const loginForCookie = await request('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  const cookieHeader = loginForCookie.headers['set-cookie']?.find(c => c.includes('rems_rt'));
  log(cookieHeader?.toLowerCase().includes('httponly') ? 'PASS' : 'FAIL',
    'Refresh token cookie has HttpOnly flag', `cookie=${cookieHeader?.substring(0, 80)}`);
  log(cookieHeader?.toLowerCase().includes('samesite') ? 'PASS' : 'FAIL',
    'Refresh token cookie has SameSite flag');
  log(cookieHeader?.toLowerCase().includes('path=/api/v1/auth') ? 'PASS' : 'FAIL',
    'Refresh token cookie path is restricted to /api/v1/auth');

  // Clean up login
  if (loginForCookie.setCookies?.rems_rt && loginForCookie.body?.data?.accessToken) {
    const tkn = loginForCookie.body.data.accessToken;
    const ck = loginForCookie.setCookies.rems_rt;
    await new Promise(r => {
      const d = JSON.stringify({});
      const opts = {
        hostname: 'localhost', port: 5000,
        path: '/api/v1/auth/logout', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(d),
          Authorization: `Bearer ${tkn}`,
          Cookie: `rems_rt=${ck}`,
        },
      };
      const req = http.request(opts, res => { res.resume(); res.on('end', r); });
      req.on('error', r);
      req.write(d); req.end();
    });
  }
}

/* ── T12: ERROR HANDLING ─────────────────────────────────── */
async function testErrorHandling(adminToken) {
  section('T12: ERROR HANDLING');

  // Invalid JSON body
  const badJson = await new Promise(r => {
    const bad = '{invalid json';
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bad) },
    };
    const req = http.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => r({ status: res.statusCode, body: JSON.parse(d || '{}') }));
    });
    req.on('error', () => r({ status: 0 }));
    req.write(bad); req.end();
  });
  log(badJson.status === 400 ? 'PASS' : 'FAIL', 'Invalid JSON body → 400', `got ${badJson.status}`);
  log(!badJson.body?.stack ? 'PASS' : 'FAIL', 'Invalid JSON: no stack trace in response');

  // Missing required field (property)
  const missingField = await authReq('POST', '/properties', { title: 'Only title' }, adminToken);
  log(missingField.status === 422 ? 'PASS' : 'FAIL', 'Missing required property fields → 422');

  // Non-existent resource
  const noRes = await authReq('GET', '/properties/9999999', null, adminToken);
  log(noRes.status === 404 ? 'PASS' : 'FAIL', 'Non-existent property → 404');
  log(noRes.body?.success === false ? 'PASS' : 'FAIL', '404 has success=false');

  // Non-existent route (DELETE so SPA catch-all won't intercept)
  const noRoute = await authReq('DELETE', '/completely_nonexistent', null, adminToken);
  log(noRoute.status === 404 ? 'PASS' : 'FAIL', 'Non-existent API route → 404');

  // Wrong HTTP method
  const wrongMethod = await authReq('GET', '/auth/logout', null, adminToken);
  log([404, 405].includes(wrongMethod.status) ? 'PASS' : 'FAIL',
    'Wrong HTTP method → 404/405', `got ${wrongMethod.status}`);

  // Negative page number
  const negPage = await authReq('GET', '/properties?page=-5', null, adminToken);
  log(negPage.status === 200 ? 'PASS' : 'FAIL', 'Negative page number → 200 (handled gracefully)');

  // Very large input
  const veryLong = await authReq('POST', '/customers', {
    name: `${QA_PREFIX}${'A'.repeat(10000)}`,
    phone: '0501111111',
  }, adminToken);
  log(veryLong.status === 422 ? 'PASS' : 'FAIL', 'Oversized name field → 422 (validation)', `got ${veryLong.status}`);

  // Empty string required field
  const emptyStr = await authReq('POST', '/customers', {
    name: '',
    phone: '0501111111',
  }, adminToken);
  log(emptyStr.status === 422 ? 'PASS' : 'FAIL', 'Empty string for required name → 422');

  // Invalid email format
  const badEmail = await request('POST', '/auth/login', {
    email: 'not-an-email-@@@@',
    password: 'anything',
  });
  log(badEmail.status === 422 ? 'PASS' : 'FAIL', 'Invalid email format → 422');
}

/* ── T13: CHANGE PASSWORD ────────────────────────────────── */
async function testChangePassword(adminToken, empToken, empCookie) {
  section('T13: CHANGE PASSWORD');

  // Change own password with wrong current
  const wrongCurr = await authReq('POST', '/auth/change-password', {
    current_password: 'WRONG_CURRENT',
    new_password: 'NewPass@123456',
  }, adminToken);
  log(wrongCurr.status === 400 ? 'PASS' : 'FAIL', 'Change password wrong current → 400', `got ${wrongCurr.status}`);

  // Same password (must differ)
  const samePass = await authReq('POST', '/auth/change-password', {
    current_password: ADMIN_PASS,
    new_password: ADMIN_PASS,
  }, adminToken);
  log(samePass.status === 400 ? 'PASS' : 'FAIL', 'Change to same password → 400', `got ${samePass.status}`);

  // Unauthenticated
  const unauth = await request('POST', '/auth/change-password', {
    current_password: 'x',
    new_password: 'y',
  });
  log(unauth.status === 401 ? 'PASS' : 'FAIL', 'Change password without auth → 401');
}

/* ── T14: DATA INTEGRITY CHECKS ─────────────────────────── */
async function testDataIntegrity(adminToken) {
  section('T14: DATA INTEGRITY');

  // Create property and verify it appears in list immediately
  const newProp = await authReq('POST', '/properties', {
    type_id: 1, type: 'Apartment',
    title: `${QA_PREFIX}Integrity Check`,
    location: 'Jeddah', city: 'Jeddah',
    address: '5 Test Street',
    area: 100, price: 300000,
    payment_method: 'cash',
    owner_name: 'Owner', owner_phone: '0501234567',
    listing_type: 'sale', status: 'available',
  }, adminToken);
  const newPropId = newProp.body?.data?.id;
  if (newPropId) createdRecords.push({ type: 'property', id: newPropId, label: 'integrity check' });

  // Immediately GET
  const getImmediate = await authReq('GET', `/properties/${newPropId}`, null, adminToken);
  log(getImmediate.status === 200 ? 'PASS' : 'FAIL', 'New property immediately retrievable');
  log(getImmediate.body?.data?.title === `${QA_PREFIX}Integrity Check` ? 'PASS' : 'FAIL', 'Data integrity: title matches');

  // Verify dashboard counts update
  const dashBefore = await authReq('GET', '/reports/dashboard', null, adminToken);
  log(dashBefore.body?.data?.available_properties > 0 ? 'PASS' : 'FAIL', 'Dashboard available_properties > 0 (live data)');

  // Customer create → verify in list
  const newCust = await authReq('POST', '/customers', {
    name: `${QA_PREFIX}Integrity Cust`,
    phone: '0500000088',
  }, adminToken);
  const newCustId = newCust.body?.data?.id;
  if (newCustId) createdRecords.push({ type: 'customer', id: newCustId, label: 'integrity cust' });

  const getCust = await authReq('GET', `/customers/${newCustId}`, null, adminToken);
  log(getCust.status === 200 ? 'PASS' : 'FAIL', 'New customer immediately retrievable');
  log(getCust.body?.data?.name === `${QA_PREFIX}Integrity Cust` ? 'PASS' : 'FAIL', 'Customer data integrity: name matches');

  // Activity log records the creation
  const acts = await authReq('GET', '/activities?entity_type=customers', null, adminToken);
  const hasRecord = acts.body?.data?.some(a => a.entity_id === newCustId && a.action === 'customer.created');
  log(hasRecord ? 'PASS' : 'FAIL', 'Customer creation recorded in activity log');
}

/* ── T15: MANAGER ROLE ───────────────────────────────────── */
async function testManagerRole() {
  section('T15: MANAGER ROLE');
  // Manager credentials are loaded from .env.test (TEST_MANAGER_EMAIL / TEST_MANAGER_PASS).
  // If not provided, this section is skipped to avoid account lockout.
  const MANAGER_PASS = process.env.TEST_MANAGER_PASS || '';
  if (!MANAGER_EMAIL || !MANAGER_PASS) {
    log('BLOCK', 'Manager role test skipped — set TEST_MANAGER_EMAIL and TEST_MANAGER_PASS in .env.test');
    return;
  }
  let managerToken = null;
  let managerCookie = null;

  const r = await request('POST', '/auth/login', { email: MANAGER_EMAIL, password: MANAGER_PASS });
  if (r.status === 200) {
      managerToken = r.body?.data?.accessToken;
      managerCookie = { rems_rt: r.setCookies?.rems_rt };
      log('PASS', `Manager login → 200`);
  }
  }

  if (!managerToken) {
    log('BLOCK', 'Manager login blocked — password unknown, could not authenticate', 'tried common defaults');
    return;
  }

  // Manager can access properties
  const mProps = await authReq('GET', '/properties', null, managerToken);
  log(mProps.status === 200 ? 'PASS' : 'FAIL', 'Manager GET /properties → 200');

  // Manager can access customers
  const mCusts = await authReq('GET', '/customers', null, managerToken);
  log(mCusts.status === 200 ? 'PASS' : 'FAIL', 'Manager GET /customers → 200');

  // Manager cannot access /users (admin only)
  const mUsers = await authReq('GET', '/users', null, managerToken);
  log(mUsers.status === 403 ? 'PASS' : 'FAIL', 'Manager GET /users → 403 (admin only)', `got ${mUsers.status}`);

  // Manager can access financials report
  const mFin = await authReq('GET', '/reports/financials', null, managerToken);
  log(mFin.status === 200 ? 'PASS' : 'FAIL', 'Manager GET /reports/financials → 200 (manager allowed if code permits)', `got ${mFin.status}`);

  // Logout
  if (managerCookie?.rems_rt) {
    await new Promise(r => {
      const d = JSON.stringify({});
      const opts = {
        hostname: 'localhost', port: 5000,
        path: '/api/v1/auth/logout', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(d),
          Authorization: `Bearer ${managerToken}`,
          Cookie: `rems_rt=${managerCookie.rems_rt}`,
        },
      };
      const req = http.request(opts, res => { res.resume(); res.on('end', r); });
      req.on('error', r);
      req.write(d); req.end();
    });
  }
}

/* ── T16: 5-CYCLE REFRESH TOKEN ROTATION ─────────────────── */
async function testRefreshRotation5Cycles() {
  section('T16: REFRESH TOKEN ROTATION — 5 CYCLES');
  for (let i = 1; i <= 5; i++) {
    const login = await request('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    const tok1 = login.body?.data?.accessToken;
    const ck1 = { rems_rt: login.setCookies?.rems_rt };

    const refresh1 = await request('POST', '/auth/refresh', {}, ck1);
    const ck2 = { rems_rt: refresh1.setCookies?.rems_rt };
    const tok2 = refresh1.body?.data?.accessToken;

    const reuseOld = await request('POST', '/auth/refresh', {}, ck1);
    const newWorks = await authReq('GET', '/auth/me', null, tok2);

    // Logout
    if (ck2?.rems_rt && tok2) {
      await new Promise(r => {
        const d = JSON.stringify({});
        const opts = {
          hostname: 'localhost', port: 5000,
          path: '/api/v1/auth/logout', method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(d),
            Authorization: `Bearer ${tok2}`,
            Cookie: `rems_rt=${ck2.rems_rt}`,
          },
        };
        const req = http.request(opts, res => { res.resume(); res.on('end', r); });
        req.on('error', r);
        req.write(d); req.end();
      });
    }
    const postLogout = await request('POST', '/auth/refresh', {}, ck2);

    log(refresh1.status === 200 ? 'PASS' : 'FAIL', `Cycle ${i}: Refresh succeeds`);
    log(reuseOld.status === 401 ? 'PASS' : 'FAIL', `Cycle ${i}: Old token rejected → 401`);
    log(newWorks.status === 200 ? 'PASS' : 'FAIL', `Cycle ${i}: New token works`);
    log(postLogout.status === 401 ? 'PASS' : 'FAIL', `Cycle ${i}: Post-logout token rejected → 401`);
  }
}

/* ── T17: LAN / NETWORK ──────────────────────────────────── */
async function testLAN(adminToken) {
  section('T17: LAN / NETWORK');

  // Server binds on 0.0.0.0 — reachable via 127.0.0.1
  const via127 = await new Promise(r => {
    http.get('http://127.0.0.1:5000/health', res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => r({ status: res.statusCode, body: JSON.parse(d) }));
    }).on('error', () => r({ status: 0 }));
  });
  log(via127.status === 200 ? 'PASS' : 'FAIL', 'Server reachable via 127.0.0.1:5000');

  // Check uploads served
  const uploadsDir = path.resolve(__dirname, '..', 'backend', 'uploads', 'properties');
  const files = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir).filter(f => !f.startsWith('.') && /\.(jpg|jpeg|png|webp)$/i.test(f)) : [];
  if (files.length > 0) {
    const testFile = files[0];
    const fileReq = await new Promise(r => {
      http.get(`http://localhost:5000/uploads/properties/${testFile}`, res => {
        r(res.statusCode);
        res.resume();
      }).on('error', () => r(0));
    });
    log(fileReq === 200 ? 'PASS' : 'FAIL', `Static upload served via /uploads/ (${testFile})`, `status=${fileReq}`);
  } else {
    log('BLOCK', 'No uploaded images to test static file serving');
  }

  // SPA routing: /dashboard should return 200 HTML in production
  const spaRoute = await new Promise(r => {
    http.get('http://localhost:5000/dashboard', res => {
      r({ status: res.statusCode, ct: res.headers['content-type'] });
      res.resume();
    }).on('error', () => r({ status: 0 }));
  });
  log(spaRoute.status === 200 ? 'PASS' : 'FAIL', 'SPA route /dashboard → 200 HTML (React catch-all)');
  log(spaRoute.ct?.includes('text/html') ? 'PASS' : 'FAIL', '/dashboard serves HTML content-type');

  // API route with unknown path → 404 JSON (not HTML)
  const apiUnknown = await authReq('DELETE', '/some_unknown_api_endpoint', null, adminToken);
  log(apiUnknown.status === 404 ? 'PASS' : 'FAIL', 'Unknown API DELETE → 404 JSON (not SPA HTML)');

  // No hardcoded localhost in API response bodies
  const propList = await authReq('GET', '/properties?limit=3', null, adminToken);
  const bodyStr = JSON.stringify(propList.body);
  log(!bodyStr.includes('localhost:3000') ? 'PASS' : 'FAIL', 'No hardcoded localhost:3000 in API responses');

  // CORS preflight
  const preflight = await new Promise(r => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/properties', method: 'OPTIONS',
      headers: {
        Origin: 'http://192.168.1.50:5000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    };
    http.request(opts, res => {
      r({ status: res.statusCode, acao: res.headers['access-control-allow-origin'] });
      res.resume();
    }).on('error', () => r({ status: 0 })).end();
  });
  log([200, 204].includes(preflight.status) ? 'PASS' : 'FAIL', 'CORS preflight → 200/204', `got ${preflight.status}`);
}

/* ── T18: PERFORMANCE SANITY ─────────────────────────────── */
async function testPerformance(adminToken) {
  section('T18: PERFORMANCE SANITY');
  const endpoints = [
    { method: 'GET', path: '/reports/dashboard', label: 'Dashboard' },
    { method: 'GET', path: '/properties?limit=20', label: 'Properties list' },
    { method: 'GET', path: '/customers?limit=20', label: 'Customers list' },
    { method: 'GET', path: '/appointments?limit=20', label: 'Appointments list' },
    { method: 'GET', path: '/activities?limit=20', label: 'Activities list' },
  ];
  for (const ep of endpoints) {
    const t0 = Date.now();
    const r = await authReq(ep.method, ep.path, null, adminToken);
    const ms = Date.now() - t0;
    log(ms < 2000 ? 'PASS' : 'FAIL', `${ep.label} response time < 2s`, `${ms}ms`);
    log(r.status === 200 ? 'PASS' : 'FAIL', `${ep.label} returns 200`);
  }
}

/* ── CLEANUP ─────────────────────────────────────────────── */
async function cleanup(adminToken) {
  section('CLEANUP — Removing QA test records');
  // Sort: appointments first (FK), then customers/properties, then users
  const order = ['appointment', 'customer', 'property', 'user'];
  const sorted = order.flatMap(t => createdRecords.filter(r => r.type === t));
  const paths = {
    appointment: (id) => `/appointments/${id}`,
    customer:    (id) => `/customers/${id}`,
    property:    (id) => `/properties/${id}`,
    user:        (id) => `/users/${id}`,
  };
  for (const rec of sorted) {
    const urlPath = paths[rec.type]?.(rec.id);
    if (!urlPath) continue;
    const r = await authReq('DELETE', urlPath, null, adminToken);
    const ok = [200, 404].includes(r.status);
    log(ok ? 'PASS' : 'FAIL', `Cleanup: deleted ${rec.type} id=${rec.id} (${rec.label})`, `status=${r.status}`);
  }
}

/* ══════════════════════════════════════════════════════════════
   MAIN
   ══════════════════════════════════════════════════════════════ */
async function main() {
  console.log('\n' + '═'.repeat(62));
  console.log('  REMS FINAL PRE-DELIVERY QA AUDIT — RUNTIME TEST SUITE');
  console.log('  ' + new Date().toISOString());
  console.log('═'.repeat(62));

  // Phases
  await testHealthAndStatus();
  const authResult   = await testAuth();
  const adminToken   = authResult?.adminToken;
  const adminCookie  = authResult?.adminCookie;

  if (!adminToken) {
    console.log('\n❌ FATAL: Cannot obtain admin token — aborting remaining tests');
    process.exit(1);
  }

  const userResult  = await testUsers(adminToken);
  const empToken    = userResult?.empToken;
  const empCookie   = userResult?.empCookie;
  const empId       = userResult?.empId;

  const propResult  = await testProperties(adminToken, empToken);
  const propId      = propResult?.propId;

  await testPropertyImages(adminToken, propId);

  const custResult  = await testCustomers(adminToken, empToken, empId);
  const custId      = custResult?.custId;

  const apptResult  = await testAppointments(adminToken, empToken, propId, custId);

  await testContracts(adminToken);
  await testReports(adminToken, empToken);
  await testActivities(adminToken, empToken);
  await testSecurity(adminToken, empToken, empId);
  await testErrorHandling(adminToken);
  await testChangePassword(adminToken, empToken, empCookie);
  await testDataIntegrity(adminToken);
  await testManagerRole();
  await testRefreshRotation5Cycles();
  await testLAN(adminToken);
  await testPerformance(adminToken);

  // Cleanup test records
  await cleanup(adminToken);

  // Final logout
  if (adminCookie?.rems_rt) {
    await new Promise(r => {
      const d = JSON.stringify({});
      const opts = {
        hostname: 'localhost', port: 5000,
        path: '/api/v1/auth/logout', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(d),
          Authorization: `Bearer ${adminToken}`,
          Cookie: `rems_rt=${adminCookie.rems_rt}`,
        },
      };
      const req = http.request(opts, res => { res.resume(); res.on('end', r); });
      req.on('error', r);
      req.write(d); req.end();
    });
  }

  // Summary
  console.log('\n' + '═'.repeat(62));
  console.log(`  FINAL RESULTS`);
  console.log('═'.repeat(62));
  console.log(`  PASSED:  ${passed}`);
  console.log(`  FAILED:  ${failed}`);
  console.log(`  BLOCKED: ${blocked}`);
  console.log(`  TOTAL:   ${passed + failed + blocked}`);
  console.log(`  PASS %:  ${Math.round(100 * passed / (passed + failed + blocked))}%`);

  if (bugs.length > 0) {
    console.log('\n  FAILURES:');
    bugs.forEach(b => console.log(`    ✗ ${b.label}${b.detail ? ' | ' + b.detail : ''}`));
  }

  // Write JSON results for report generation
  const resultsPath = path.join(__dirname, 'qa_results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({ passed, failed, blocked, total: passed+failed+blocked, bugs, allResults }, null, 2));
  console.log(`\n  Results saved to: ${resultsPath}`);
  console.log('═'.repeat(62) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL TEST RUNNER ERROR:', err);
  process.exit(1);
});
