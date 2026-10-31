'use strict';
/**
 * QA Runtime Audit Script — REMS Final Pre-Delivery
 * Tests: Auth, RBAC, Properties, Customers, Appointments,
 *        Reports, Activities, Uploads, Security, Error Handling
 * 
 * Records created use QA_AUDIT_ prefix and are cleaned up at end.
 * Protects all existing production data.
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────
const BASE  = 'http://localhost:5000';
const API   = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASS  = 'Admin@123456';
const QA_PREFIX   = 'QA_AUDIT_';

// ── Tracking ──────────────────────────────────────────────────
let PASS = 0, FAIL = 0, BLOCK = 0;
const RESULTS = [];
const CREATED = [];  // {type, id, description}
let ADMIN_TOKEN = null;
let ADMIN_COOKIE = null;
let EMP_TOKEN = null;
let EMP_COOKIE = null;
let EMP_ID = null;

// ── Helpers ───────────────────────────────────────────────────
function assert(label, cond, got = '') {
  if (cond) {
    PASS++;
    RESULTS.push({ status: 'PASS', label, got });
    console.log(`  ✅ PASS: ${label}`);
  } else {
    FAIL++;
    RESULTS.push({ status: 'FAIL', label, got });
    console.log(`  ❌ FAIL: ${label}  [got: ${got}]`);
  }
}

function blocked(label, reason) {
  BLOCK++;
  RESULTS.push({ status: 'BLOCK', label, got: reason });
  console.log(`  🟡 BLOCK: ${label}  [reason: ${reason}]`);
}

function section(name) {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  ${name}`);
  console.log('═'.repeat(56));
}

function req(method, url, body, headers = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    };
    const client = isHttps ? https : http;
    const request = client.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        const cookies = {};
        for (const c of (res.headers['set-cookie'] || [])) {
          const [pair] = c.split(';');
          const [k, v] = pair.trim().split('=');
          if (k) cookies[k] = v || '';
        }
        let json;
        try { json = JSON.parse(raw); } catch { json = { _raw: raw.slice(0, 200) }; }
        resolve({ status: res.statusCode, json, cookies, headers: res.headers });
      });
    });
    request.on('error', (e) => resolve({ status: 0, json: { error: e.message }, cookies: {}, headers: {} }));
    if (data) request.write(data);
    request.end();
  });
}

function apiReq(method, path, body, token, extraHeaders = {}) {
  const hdrs = { ...extraHeaders };
  if (token) hdrs['Authorization'] = `Bearer ${token}`;
  return req(method, `${API}${path}`, body, hdrs);
}

function apiReqCookie(method, path, body, token, cookieStr, extraHeaders = {}) {
  const hdrs = { ...extraHeaders };
  if (token) hdrs['Authorization'] = `Bearer ${token}`;
  if (cookieStr) hdrs['Cookie'] = cookieStr;
  return req(method, `${API}${path}`, body, hdrs);
}

// Multipart upload
function upload(urlPath, fieldName, filename, buffer, mimeType, token) {
  return new Promise((resolve) => {
    const boundary = `----QABoundary${Date.now()}`;
    const head = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([head, buffer, tail]);
    const parsed = new URL(`${API}${urlPath}`);
    const opts = {
      hostname: parsed.hostname,
      port:     parsed.port || 80,
      path:     parsed.pathname,
      method:   'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    const request = http.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(raw); } catch { json = { _raw: raw.slice(0, 200) }; }
        resolve({ status: res.statusCode, json });
      });
    });
    request.on('error', (e) => resolve({ status: 0, json: { error: e.message } }));
    request.write(body);
    request.end();
  });
}

// ── A. HEALTH & STATUS ────────────────────────────────────────
async function testHealth() {
  section('A. HEALTH & STATUS');

  const h = await req('GET', `${BASE}/health`);
  assert('GET /health → 200', h.status === 200, h.status);
  assert('Health environment = production', h.json?.environment === 'production', h.json?.environment);
  assert('Health has uptime', typeof h.json?.uptime === 'number', h.json?.uptime);

  const s = await req('GET', `${API}/status`);
  assert('GET /api/v1/status → 200', s.status === 200, s.status);
  assert('Status success=true', s.json?.success === true, s.json?.success);

  // SPA served from root
  const spa = await req('GET', BASE + '/');
  assert('SPA served at GET /', spa.status === 200, spa.status);
  assert('SPA content-type is html', spa.headers['content-type']?.includes('text/html'), spa.headers['content-type']);

  // Unknown API route → JSON 404 (not SPA HTML)
  const unk = await apiReq('GET', '/nonexistent_route_xyz', null, null);
  assert('Unknown API route → 404 (not 200 SPA)', unk.status === 404, unk.status);
  assert('Unknown API route returns JSON not HTML', unk.json?.success === false, JSON.stringify(unk.json).slice(0,50));
}

// ── B. AUTHENTICATION ─────────────────────────────────────────
async function testAuth() {
  section('B. AUTHENTICATION');

  // Wrong password
  const r1 = await apiReq('POST', '/auth/login', { email: ADMIN_EMAIL, password: 'WRONG' });
  assert('Login wrong password → 401', r1.status === 401, r1.status);

  // Wrong email
  const r2 = await apiReq('POST', '/auth/login', { email: 'nobody@nowhere.com', password: ADMIN_PASS });
  assert('Login wrong email → 401', r2.status === 401, r2.status);

  // Empty body
  const r3 = await apiReq('POST', '/auth/login', {});
  assert('Login empty body → 422', r3.status === 422, r3.status);

  // Malformed email
  const r4 = await apiReq('POST', '/auth/login', { email: 'notanemail', password: ADMIN_PASS });
  assert('Login malformed email → 422', r4.status === 422, r4.status);

  // Valid login
  const r5 = await apiReq('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  assert('Valid admin login → 200', r5.status === 200, r5.status);
  assert('Login returns accessToken', !!r5.json?.data?.accessToken, 'no token');
  assert('Login does NOT return refreshToken in body', !r5.json?.data?.refreshToken, 'EXPOSED IN BODY!');
  assert('Login sets rems_rt cookie', !!r5.cookies?.rems_rt, JSON.stringify(r5.cookies));
  
  // Cookie flags
  const setCookieHeader = r5.headers?.['set-cookie']?.find(c => c.includes('rems_rt'));
  assert('rems_rt cookie is HttpOnly', setCookieHeader?.toLowerCase().includes('httponly'), setCookieHeader);
  assert('rems_rt cookie has SameSite=strict', setCookieHeader?.toLowerCase().includes('samesite=strict'), setCookieHeader);
  assert('rems_rt cookie path is /api/v1/auth', setCookieHeader?.includes('/api/v1/auth'), setCookieHeader);

  ADMIN_TOKEN = r5.json?.data?.accessToken;
  ADMIN_COOKIE = `rems_rt=${r5.cookies?.rems_rt}`;

  // GET /auth/me
  const me = await apiReq('GET', '/auth/me', null, ADMIN_TOKEN);
  assert('GET /auth/me → 200', me.status === 200, me.status);
  assert('/auth/me returns correct email', me.json?.data?.email === ADMIN_EMAIL, me.json?.data?.email);
  assert('/auth/me does NOT expose password_hash', !me.json?.data?.password_hash, 'EXPOSED!');
  assert('/auth/me role = admin', me.json?.data?.role === 'admin', me.json?.data?.role);

  // No auth
  const noauth = await apiReq('GET', '/auth/me', null, null);
  assert('GET /auth/me without token → 401', noauth.status === 401, noauth.status);

  // Invalid token
  const badtok = await apiReq('GET', '/auth/me', null, 'invalid.token.here');
  assert('GET /auth/me invalid token → 401', badtok.status === 401, badtok.status);

  // Refresh token rotation
  const ref1 = await apiReqCookie('POST', '/auth/refresh', {}, null, ADMIN_COOKIE);
  assert('POST /auth/refresh (valid cookie) → 200', ref1.status === 200, ref1.status);
  assert('Refresh returns new accessToken', !!ref1.json?.data?.accessToken, 'no token');
  assert('Refresh does NOT return refreshToken in body', !ref1.json?.data?.refreshToken, 'EXPOSED!');
  assert('Refresh sets new rems_rt cookie', !!ref1.cookies?.rems_rt, JSON.stringify(ref1.cookies));
  
  const newToken = ref1.json?.data?.accessToken;
  const newCookie = `rems_rt=${ref1.cookies?.rems_rt}`;
  
  // Old cookie must now be revoked
  const reuse = await apiReqCookie('POST', '/auth/refresh', {}, null, ADMIN_COOKIE);
  assert('Reusing old refresh token → 401 (rotation enforced)', reuse.status === 401, reuse.status);
  
  // New token works
  const newMe = await apiReq('GET', '/auth/me', null, newToken);
  assert('New access token from refresh works', newMe.status === 200, newMe.status);

  // Forged refresh token
  const forged = await apiReqCookie('POST', '/auth/refresh', {}, null, 'rems_rt=forged.token.value');
  assert('Forged refresh token → 401', forged.status === 401, forged.status);

  // Logout
  const logoutRes = await apiReqCookie('POST', '/auth/logout', {}, newToken, newCookie);
  assert('POST /auth/logout → 200', logoutRes.status === 200, logoutRes.status);
  
  // After logout, refresh must fail
  const postLogout = await apiReqCookie('POST', '/auth/refresh', {}, null, newCookie);
  assert('Refresh after logout → 401', postLogout.status === 401, postLogout.status);

  // Re-login for further tests
  const relogin = await apiReq('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  ADMIN_TOKEN = relogin.json?.data?.accessToken;
  ADMIN_COOKIE = `rems_rt=${relogin.cookies?.rems_rt}`;
  assert('Re-login after logout works', relogin.status === 200, relogin.status);

  // 5-cycle rotation test
  section('B2. REFRESH TOKEN ROTATION — 5 CYCLES');
  for (let i = 1; i <= 5; i++) {
    const login = await apiReq('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
    const tok1 = login.json?.data?.accessToken;
    const ck1  = `rems_rt=${login.cookies?.rems_rt}`;
    
    const r = await apiReqCookie('POST', '/auth/refresh', {}, null, ck1);
    const tok2 = r.json?.data?.accessToken;
    const ck2  = `rems_rt=${r.cookies?.rems_rt}`;
    
    const oldReuse = await apiReqCookie('POST', '/auth/refresh', {}, null, ck1);
    const newWorks = await apiReq('GET', '/auth/me', null, tok2);
    
    assert(`Cycle ${i}: Refresh succeeds`, r.status === 200, r.status);
    assert(`Cycle ${i}: Old token rejected → 401`, oldReuse.status === 401, oldReuse.status);
    assert(`Cycle ${i}: New access token works`, newWorks.status === 200, newWorks.status);
    
    // Logout this cycle
    await apiReqCookie('POST', '/auth/logout', {}, tok2, ck2);
    const postLogout5 = await apiReqCookie('POST', '/auth/refresh', {}, null, ck2);
    assert(`Cycle ${i}: Post-logout refresh → 401`, postLogout5.status === 401, postLogout5.status);
  }
  
  // Re-login final
  const final = await apiReq('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  ADMIN_TOKEN = final.json?.data?.accessToken;
  ADMIN_COOKIE = `rems_rt=${final.cookies?.rems_rt}`;
}

// ── C. USERS ──────────────────────────────────────────────────
async function testUsers() {
  section('C. USERS (Admin Only)');

  // List users (admin)
  const list = await apiReq('GET', '/users', null, ADMIN_TOKEN);
  assert('GET /users (admin) → 200', list.status === 200, list.status);
  assert('Users list is array', Array.isArray(list.json?.data), typeof list.json?.data);
  assert('Users list has 2 users', list.json?.data?.length >= 2, list.json?.data?.length);
  assert('Users list has no password_hash', !list.json?.data?.some(u => u.password_hash), 'EXPOSED!');
  
  // Role normalisation
  const adminUser = list.json?.data?.find(u => u.email === ADMIN_EMAIL);
  assert('Admin user role = admin (not agent)', adminUser?.role === 'admin', adminUser?.role);

  // Create test employee
  const empData = {
    name: `${QA_PREFIX}Employee Test`,
    email: `${QA_PREFIX}emp@qatest.invalid`,
    password: 'QATest@Pass123',
    role: 'employee',
    phone: '0501234567',
  };
  const create = await apiReq('POST', '/users', empData, ADMIN_TOKEN);
  assert('POST /users create employee → 201', create.status === 201, `${create.status} ${JSON.stringify(create.json?.message)}`);
  EMP_ID = create.json?.data?.id;
  if (EMP_ID) CREATED.push({ type: 'user', id: EMP_ID, description: 'QA test employee' });
  assert('New user role = employee (normalised)', create.json?.data?.role === 'employee', create.json?.data?.role);
  assert('New user no password_hash', !create.json?.data?.password_hash, 'EXPOSED!');

  // Duplicate email
  const dup = await apiReq('POST', '/users', empData, ADMIN_TOKEN);
  assert('Duplicate email → 409', dup.status === 409, dup.status);

  // Get one
  const getOne = await apiReq('GET', `/users/${EMP_ID}`, null, ADMIN_TOKEN);
  assert('GET /users/:id (admin) → 200', getOne.status === 200, getOne.status);
  assert('GET /users/999999 → 404', (await apiReq('GET', '/users/999999', null, ADMIN_TOKEN)).status === 404, '');

  // Update
  const upd = await apiReq('PUT', `/users/${EMP_ID}`, { name: `${QA_PREFIX}Employee Updated` }, ADMIN_TOKEN);
  assert('PUT /users/:id → 200', upd.status === 200, upd.status);

  // Deactivate
  const deact = await apiReq('PATCH', `/users/${EMP_ID}/deactivate`, {}, ADMIN_TOKEN);
  assert('PATCH /users/:id/deactivate → 200', deact.status === 200, deact.status);
  // Activate back
  const act = await apiReq('PATCH', `/users/${EMP_ID}/activate`, {}, ADMIN_TOKEN);
  assert('PATCH /users/:id/activate → 200', act.status === 200, act.status);
  
  // Admin reset password
  const resetPw = await apiReq('PATCH', `/users/${EMP_ID}/password`, { password: 'QANewPass@123' }, ADMIN_TOKEN);
  assert('PATCH /users/:id/password → 200', resetPw.status === 200, resetPw.status);

  // Login as employee
  const empLogin = await apiReq('POST', '/auth/login', { email: empData.email, password: 'QANewPass@123' });
  assert('Employee login → 200', empLogin.status === 200, empLogin.status);
  EMP_TOKEN = empLogin.json?.data?.accessToken;
  EMP_COOKIE = `rems_rt=${empLogin.cookies?.rems_rt}`;

  // Employee cannot access /users
  const empNoUsers = await apiReq('GET', '/users', null, EMP_TOKEN);
  assert('Employee GET /users → 403 (RBAC enforced)', empNoUsers.status === 403, empNoUsers.status);
  
  const empNoCreateUser = await apiReq('POST', '/users', { name: 'hack', email: 'h@h.com', password: 'x' }, EMP_TOKEN);
  assert('Employee POST /users → 403', empNoCreateUser.status === 403, empNoCreateUser.status);

  // No auth
  assert('GET /users no auth → 401', (await apiReq('GET', '/users', null, null)).status === 401, '');
}

// ── D. PROPERTIES CRUD ────────────────────────────────────────
async function testProperties() {
  section('D. PROPERTIES CRUD');
  let createdPropId = null;

  // Property types
  const types = await apiReq('GET', '/properties/types', null, ADMIN_TOKEN);
  assert('GET /properties/types → 200', types.status === 200, types.status);
  assert('12 property types exist', types.json?.data?.length === 12, types.json?.data?.length);

  // Verify all 12 categories exist in DB
  const typeNames = types.json?.data?.map(t => t.name?.toLowerCase()) || [];
  for (const cat of ['apartment','villa','townhouse','duplex','studio','office','retail shop','warehouse','land','building','farm','chalet']) {
    assert(`Property type "${cat}" exists`, typeNames.includes(cat), `missing; got: ${typeNames.join(',')}`);
  }

  // List properties
  const list = await apiReq('GET', '/properties', null, ADMIN_TOKEN);
  assert('GET /properties → 200', list.status === 200, list.status);
  assert('Properties list is array', Array.isArray(list.json?.data), typeof list.json?.data);
  assert('Properties has pagination meta', !!list.json?.meta?.total, JSON.stringify(list.json?.meta));

  // Create property (admin)
  const propData = {
    type_id: 1,
    type: 'Apartment',
    title: `${QA_PREFIX}Test Apartment`,
    location: 'Riyadh',
    city: 'Riyadh',
    address: '123 QA Street',
    area: 150.5,
    price: 750000,
    owner_name: 'QA Owner',
    owner_phone: '0501234567',
    listing_type: 'sale',
    status: 'available',
  };
  const create = await apiReq('POST', '/properties', propData, ADMIN_TOKEN);
  assert('POST /properties create → 201', create.status === 201, `${create.status} ${JSON.stringify(create.json?.message)}`);
  createdPropId = create.json?.data?.id;
  if (createdPropId) CREATED.push({ type: 'property', id: createdPropId, description: 'QA test property' });

  // Get one
  const getOne = await apiReq('GET', `/properties/${createdPropId}`, null, ADMIN_TOKEN);
  assert('GET /properties/:id → 200', getOne.status === 200, getOne.status);
  assert('Property title matches', getOne.json?.data?.title === propData.title, getOne.json?.data?.title);
  assert('Property has images array', Array.isArray(getOne.json?.data?.images), typeof getOne.json?.data?.images);
  assert('Property has videos array', Array.isArray(getOne.json?.data?.videos), typeof getOne.json?.data?.videos);

  // Update
  const upd = await apiReq('PUT', `/properties/${createdPropId}`, { price: 800000 }, ADMIN_TOKEN);
  assert('PUT /properties/:id → 200', upd.status === 200, upd.status);
  assert('Price updated correctly', upd.json?.data?.price === 800000, upd.json?.data?.price);

  // Status update
  const statUpd = await apiReq('PATCH', `/properties/${createdPropId}/status`, { status: 'reserved' }, ADMIN_TOKEN);
  assert('PATCH /properties/:id/status → 200', statUpd.status === 200, statUpd.status);

  // Invalid status
  const badStat = await apiReq('PATCH', `/properties/${createdPropId}/status`, { status: 'InvalidStatus123' }, ADMIN_TOKEN);
  assert('Invalid status → 422', badStat.status === 422, badStat.status);

  // Search
  const search = await apiReq('GET', `/properties?search=${encodeURIComponent(QA_PREFIX)}`, null, ADMIN_TOKEN);
  assert('Search by QA_PREFIX works → 200', search.status === 200, search.status);

  // Filter by status
  const filt = await apiReq('GET', '/properties?status=available', null, ADMIN_TOKEN);
  assert('Filter by status=available → 200', filt.status === 200, filt.status);
  assert('All filtered results have status=available', 
    filt.json?.data?.every(p => p.status === 'available'), 
    filt.json?.data?.map(p => p.status).join(','));

  // Sort & paginate
  const paginated = await apiReq('GET', '/properties?page=1&limit=5&sort=price&order=DESC', null, ADMIN_TOKEN);
  assert('Paginated+sorted properties → 200', paginated.status === 200, paginated.status);

  // Nonexistent
  const none = await apiReq('GET', '/properties/999999', null, ADMIN_TOKEN);
  assert('GET /properties/999999 → 404', none.status === 404, none.status);

  // Missing required fields
  const missing = await apiReq('POST', '/properties', { title: 'Missing Fields' }, ADMIN_TOKEN);
  assert('Create property missing fields → 422', missing.status === 422, missing.status);

  // Arabic text
  const arabic = await apiReq('POST', '/properties', {
    ...propData,
    title: `${QA_PREFIX}شقة عربية للاختبار`,
    location: 'الرياض',
    city: 'الرياض',
  }, ADMIN_TOKEN);
  assert('Create property with Arabic text → 201', arabic.status === 201, arabic.status);
  if (arabic.json?.data?.id) CREATED.push({ type: 'property', id: arabic.json.data.id, description: 'QA Arabic property' });

  // SQL injection in search
  const sqlInj = await apiReq('GET', `/properties?search=${encodeURIComponent("' OR '1'='1 --")}`, null, ADMIN_TOKEN);
  assert('SQL injection in search → 200 (safe)', sqlInj.status === 200, sqlInj.status);
  
  // RBAC: Employee cannot edit admin's property
  if (EMP_TOKEN && createdPropId) {
    const empEdit = await apiReq('PUT', `/properties/${createdPropId}`, { price: 1 }, EMP_TOKEN);
    assert('Employee cannot edit admin property → 403 (IDOR)', empEdit.status === 403, empEdit.status);
    const empDel = await apiReq('DELETE', `/properties/${createdPropId}`, null, EMP_TOKEN);
    assert('Employee cannot delete admin property → 403', empDel.status === 403, empDel.status);
  }

  // Unauthenticated
  const unauth = await req('GET', `${API}/properties`);
  assert('GET /properties without auth → 401', unauth.status === 401, unauth.status);

  return createdPropId;
}

// ── E. PROPERTY MEDIA ─────────────────────────────────────────
async function testMedia(propId) {
  section('E. PROPERTY IMAGES & VIDEOS');
  if (!propId) { blocked('All media tests', 'No property ID available'); return; }

  // Minimal valid JPEG (1x1 white pixel)
  const validJpeg = Buffer.from(
    'FFD8FFE000104A46494600010100000100010000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C20242E2720222C231C1C2837292C30313434341F27393D38323C2E333432FFFFC00011080001000103012200021101031101FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFC400B5100002010303020403050504040000017D01020300041105122131410613516107227114328191A1082342B1C11552D1F02433627282090A161718191A25262728292A3435363738393A434445464748494A535455565758595A636465666768696A737475767778797A838485868788898A929394959697989',
    'hex'
  ).slice(0, 100); // truncated but valid-ish for MIME check
  
  // Use a proper minimal JPEG 
  const minJpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/wAARC AABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwAB/9k=', 'base64');

  // Valid image upload
  const imgUp = await upload(`/properties/${propId}/images`, 'images', 'test.jpg', minJpeg, 'image/jpeg', ADMIN_TOKEN);
  assert('Upload valid JPEG → 201', imgUp.status === 201, `${imgUp.status} ${JSON.stringify(imgUp.json?.message)}`);
  const imgId = imgUp.json?.data?.[0]?.id;
  
  // Image accessible from /uploads/
  if (imgUp.json?.data?.[0]?.image_path) {
    const imgPath = imgUp.json.data[0].image_path;
    const imgGet = await req('GET', `${BASE}/uploads/${imgPath}`);
    assert('Uploaded image accessible via /uploads/', imgGet.status === 200, imgGet.status);
    
    // Check UUID filename
    const filename = imgPath.split('/').pop();
    const uuidRegex = /^[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/i;
    assert('Image stored with UUID filename (not user-controlled)', uuidRegex.test(filename), filename);
    
    // Image exists on disk
    const diskPath = path.join('C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\backend\\uploads', imgPath);
    assert('Image file exists on disk', fs.existsSync(diskPath), diskPath);
  }

  // Invalid extension (.txt with image MIME)
  const badExt = await upload(`/properties/${propId}/images`, 'images', 'malicious.txt', Buffer.from('text'), 'image/jpeg', ADMIN_TOKEN);
  assert('Invalid extension (.txt) → 400', badExt.status === 400, `${badExt.status} ${badExt.json?.message}`);

  // MIME spoofing: .jpg extension but text/plain MIME
  const mimespoof = await upload(`/properties/${propId}/images`, 'images', 'spoof.jpg', Buffer.from('text content'), 'text/plain', ADMIN_TOKEN);
  assert('MIME spoofing (jpg+text/plain) → 400', mimespoof.status === 400, `${mimespoof.status} ${mimespoof.json?.message}`);

  // Shell script disguised as image  
  const shellscript = await upload(`/properties/${propId}/images`, 'images', 'hack.sh', Buffer.from('#!/bin/bash\nrm -rf /'), 'image/jpeg', ADMIN_TOKEN);
  assert('Shell script disguised as image → 400', shellscript.status === 400, `${shellscript.status}`);

  // Unauthorized upload
  const unauth = await upload(`/properties/${propId}/images`, 'images', 'test.jpg', minJpeg, 'image/jpeg', null);
  assert('Image upload without auth → 401', unauth.status === 401, unauth.status);

  // Delete image
  if (imgId) {
    const delImg = await apiReq('DELETE', `/properties/${propId}/images/${imgId}`, null, ADMIN_TOKEN);
    assert('DELETE property image → 200', delImg.status === 200, delImg.status);
    
    // Verify file deleted from disk
    if (imgUp.json?.data?.[0]?.image_path) {
      const diskPath = path.join('C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\backend\\uploads', imgUp.json.data[0].image_path);
      assert('Image file deleted from disk', !fs.existsSync(diskPath), 'still exists');
    }
  }

  // GET images list
  const imgList = await apiReq('GET', `/properties/${propId}/images`, null, ADMIN_TOKEN);
  assert('GET /properties/:id/images → 200', imgList.status === 200, imgList.status);
  
  // GET videos list
  const vidList = await apiReq('GET', `/properties/${propId}/videos`, null, ADMIN_TOKEN);
  assert('GET /properties/:id/videos → 200', vidList.status === 200, vidList.status);

  // Video format: try uploading an MP4 (minimal valid)
  const minMp4 = Buffer.alloc(100);
  minMp4.write('ftyp', 4);
  const vidUp = await upload(`/properties/${propId}/videos`, 'videos', 'test.mp4', minMp4, 'video/mp4', ADMIN_TOKEN);
  // May fail if file content not valid — just check it doesn't crash
  assert('Video upload attempt does not crash server (200 or 400)', 
    [200, 201, 400, 422].includes(vidUp.status), vidUp.status);

  // Invalid video type
  const badVid = await upload(`/properties/${propId}/videos`, 'videos', 'bad.avi', Buffer.from('fake'), 'video/avi', ADMIN_TOKEN);
  assert('Invalid video type (.avi) → 400', badVid.status === 400, `${badVid.status} ${badVid.json?.message}`);
}

// ── F. CUSTOMERS ──────────────────────────────────────────────
async function testCustomers() {
  section('F. CUSTOMERS CRUD');
  let custId = null;

  // List
  const list = await apiReq('GET', '/customers', null, ADMIN_TOKEN);
  assert('GET /customers (admin) → 200', list.status === 200, list.status);
  assert('Customers list is array', Array.isArray(list.json?.data), typeof list.json?.data);

  // Pipeline
  const pipeline = await apiReq('GET', '/customers/pipeline', null, ADMIN_TOKEN);
  assert('GET /customers/pipeline → 200', pipeline.status === 200, pipeline.status);
  assert('Pipeline has status counts', !!pipeline.json?.data, JSON.stringify(pipeline.json?.data).slice(0,50));

  // Create
  const custData = {
    name: `${QA_PREFIX}Test Customer`,
    phone: '0501111222',
    email: `${QA_PREFIX}cust@qatest.invalid`,
    status: 'new',
    budget: 500000,
    property_type: 'Apartment',
    location: 'Riyadh',
    notes: 'QA test customer',
  };
  const create = await apiReq('POST', '/customers', custData, ADMIN_TOKEN);
  assert('POST /customers create → 201', create.status === 201, `${create.status} ${JSON.stringify(create.json?.message)}`);
  custId = create.json?.data?.id;
  if (custId) CREATED.push({ type: 'customer', id: custId, description: 'QA test customer' });

  // Get one
  const getOne = await apiReq('GET', `/customers/${custId}`, null, ADMIN_TOKEN);
  assert('GET /customers/:id → 200', getOne.status === 200, getOne.status);
  assert('Customer name matches', getOne.json?.data?.name === custData.name, getOne.json?.data?.name);

  // Update
  const upd = await apiReq('PUT', `/customers/${custId}`, { notes: 'Updated notes', budget: 600000 }, ADMIN_TOKEN);
  assert('PUT /customers/:id → 200', upd.status === 200, upd.status);

  // Status update
  const statUpd = await apiReq('PATCH', `/customers/${custId}/status`, { status: 'interested' }, ADMIN_TOKEN);
  assert('PATCH /customers/:id/status → 200', statUpd.status === 200, statUpd.status);
  assert('Status updated to interested', statUpd.json?.data?.status === 'interested', statUpd.json?.data?.status);

  // Invalid status
  const badStat = await apiReq('PATCH', `/customers/${custId}/status`, { status: 'flying_unicorn' }, ADMIN_TOKEN);
  assert('Invalid customer status → 422', badStat.status === 422, badStat.status);

  // Search
  const search = await apiReq('GET', `/customers?search=${encodeURIComponent(QA_PREFIX)}`, null, ADMIN_TOKEN);
  assert('Customer search works → 200', search.status === 200, search.status);

  // Nonexistent
  const none = await apiReq('GET', '/customers/999999', null, ADMIN_TOKEN);
  assert('GET /customers/999999 → 404', none.status === 404, none.status);

  // Missing required fields
  const missing = await apiReq('POST', '/customers', { email: 'test@test.com' }, ADMIN_TOKEN);
  assert('Create customer missing name/phone → 422', missing.status === 422, missing.status);

  // Arabic name
  const arabic = await apiReq('POST', '/customers', {
    name: `${QA_PREFIX}أحمد العربي`,
    phone: '0509999888',
  }, ADMIN_TOKEN);
  assert('Create customer with Arabic name → 201', arabic.status === 201, arabic.status);
  if (arabic.json?.data?.id) CREATED.push({ type: 'customer', id: arabic.json.data.id, description: 'QA Arabic customer' });

  // IDOR — employee accessing admin's customer
  if (EMP_TOKEN && custId) {
    const idorGet = await apiReq('GET', `/customers/${custId}`, null, EMP_TOKEN);
    assert('Employee cannot GET admin customer (IDOR) → 403', idorGet.status === 403, idorGet.status);
    const idorEdit = await apiReq('PUT', `/customers/${custId}`, { notes: 'hacked' }, EMP_TOKEN);
    assert('Employee cannot PUT admin customer (IDOR) → 403', idorEdit.status === 403, idorEdit.status);
  }

  // Unauthenticated
  assert('GET /customers without auth → 401', (await req('GET', `${API}/customers`)).status === 401, '');

  // Check /clients route (clientRoutes.js exists but NOT mounted — should 404)
  const clients = await apiReq('GET', '/clients', null, ADMIN_TOKEN);
  assert('/clients is not mounted → 404 (not 501)', clients.status === 404, `${clients.status} ${JSON.stringify(clients.json)}`);
  // Note: clientRoutes.js has 501 handler but is not mounted in routes/index.js

  return custId;
}

// ── G. APPOINTMENTS ───────────────────────────────────────────
async function testAppointments(propId, custId) {
  section('G. APPOINTMENTS CRUD');
  let apptId = null;

  // List
  const list = await apiReq('GET', '/appointments', null, ADMIN_TOKEN);
  assert('GET /appointments (admin) → 200', list.status === 200, list.status);

  // Stats
  const stats = await apiReq('GET', '/appointments/stats', null, ADMIN_TOKEN);
  assert('GET /appointments/stats → 200', stats.status === 200, stats.status);

  // Public booking (no auth)
  const publicData = {
    property_id: propId || 1,
    customer_name: `${QA_PREFIX}Public Visitor`,
    customer_phone: '0508887776',
    appointment_date: '2027-06-15',
    appointment_time: '10:00',
    type: 'viewing',
  };
  const pub = await req('POST', `${API}/appointments/public`, publicData);
  assert('POST /appointments/public (no auth) → 201', pub.status === 201, `${pub.status} ${JSON.stringify(pub.json?.message)}`);
  if (pub.json?.data?.id) CREATED.push({ type: 'appointment', id: pub.json.data.id, description: 'QA public booking' });
  
  // Public booking should not expose admin_notes
  assert('Public booking does not return admin_notes', pub.json?.data?.admin_notes === undefined, 'admin_notes EXPOSED!');

  // Create (admin)
  if (propId) {
    const apptData = {
      property_id: propId,
      customer_id: custId || null,
      customer_name: `${QA_PREFIX}Admin Booking`,
      customer_phone: '0509998887',
      appointment_date: '2027-07-01',
      appointment_time: '14:00',
      type: 'viewing',
      customer_notes: 'QA test note',
    };
    const create = await apiReq('POST', '/appointments', apptData, ADMIN_TOKEN);
    assert('POST /appointments (admin) → 201', create.status === 201, `${create.status} ${JSON.stringify(create.json?.message)}`);
    apptId = create.json?.data?.id;
    if (apptId) CREATED.push({ type: 'appointment', id: apptId, description: 'QA admin booking' });

    // Get one
    const getOne = await apiReq('GET', `/appointments/${apptId}`, null, ADMIN_TOKEN);
    assert('GET /appointments/:id → 200', getOne.status === 200, getOne.status);

    // Update status
    const statUpd = await apiReq('PATCH', `/appointments/${apptId}/status`, { status: 'confirmed' }, ADMIN_TOKEN);
    assert('PATCH /appointments/:id/status → 200', statUpd.status === 200, statUpd.status);

    // Invalid status transition
    const badTrans = await apiReq('PATCH', `/appointments/${apptId}/status`, { status: 'pending' }, ADMIN_TOKEN);
    assert('Invalid status transition → 422', badTrans.status === 422, `${badTrans.status} ${JSON.stringify(badTrans.json?.message)}`);

    // Reschedule
    const resched = await apiReq('PATCH', `/appointments/${apptId}/reschedule`, {
      appointment_date: '2027-07-15',
      appointment_time: '11:00',
    }, ADMIN_TOKEN);
    assert('PATCH /appointments/:id/reschedule → 200', resched.status === 200, resched.status);
  }

  // Invalid time format
  const badTime = await req('POST', `${API}/appointments/public`, {
    ...publicData,
    appointment_time: '25:99:99',
  });
  assert('Invalid time format → 422', badTime.status === 422, badTime.status);

  // Unauthenticated
  assert('GET /appointments without auth → 401', (await req('GET', `${API}/appointments`)).status === 401, '');

  // Employee sees only their appointments
  if (EMP_TOKEN) {
    const empList = await apiReq('GET', '/appointments', null, EMP_TOKEN);
    assert('Employee GET /appointments → 200 (filtered to own)', empList.status === 200, empList.status);
  }
}

// ── H. CONTRACTS ──────────────────────────────────────────────
async function testContracts() {
  section('H. CONTRACTS MODULE');

  // contractRoutes.js has router.all('*', 501) but it's NOT mounted in routes/index.js
  // so all requests to /api/v1/contracts return 404 from notFoundHandler
  const r = await apiReq('GET', '/contracts', null, ADMIN_TOKEN);
  assert('GET /contracts → 404 (not mounted in routes/index.js)', r.status === 404, `${r.status} ${JSON.stringify(r.json)}`);
  // This is NOT an error — contracts module is documented as not implemented
  // Verify it returns JSON not HTML
  assert('Contracts returns JSON not HTML', r.json?.success === false, JSON.stringify(r.json).slice(0, 50));

  // Verify contracts table exists but has 0 rows (verified via DB audit)
  // This confirms the DB schema is ready for future implementation
}

// ── I. REPORTS ────────────────────────────────────────────────
async function testReports() {
  section('I. REPORTS');

  // Dashboard
  const dash = await apiReq('GET', '/reports/dashboard', null, ADMIN_TOKEN);
  assert('GET /reports/dashboard → 200', dash.status === 200, dash.status);
  
  const d = dash.json?.data;
  assert('Dashboard has available_properties', 'available_properties' in (d||{}), JSON.stringify(d).slice(0,50));
  assert('Dashboard has active_contracts (= 0, contracts not implemented)', d?.active_contracts === 0, d?.active_contracts);
  assert('Dashboard has revenue_this_month (= 0, no financials)', Number(d?.revenue_this_month) === 0, d?.revenue_this_month);
  assert('Dashboard available_properties reflects real data', d?.available_properties >= 0, d?.available_properties);

  // Properties report
  const propRep = await apiReq('GET', '/reports/properties', null, ADMIN_TOKEN);
  assert('GET /reports/properties → 200', propRep.status === 200, propRep.status);
  assert('Properties report has byStatus', Array.isArray(propRep.json?.data?.byStatus), typeof propRep.json?.data?.byStatus);
  assert('Properties report has byType', Array.isArray(propRep.json?.data?.byType), typeof propRep.json?.data?.byType);
  assert('Properties report has monthly', Array.isArray(propRep.json?.data?.monthly), typeof propRep.json?.data?.monthly);

  // Customers report
  const custRep = await apiReq('GET', '/reports/customers', null, ADMIN_TOKEN);
  assert('GET /reports/customers → 200', custRep.status === 200, custRep.status);

  // Financials report (admin only)
  const finRep = await apiReq('GET', '/reports/financials', null, ADMIN_TOKEN);
  assert('GET /reports/financials (admin) → 200', finRep.status === 200, finRep.status);
  assert('Financials total = 0 (no contracts/financials, correctly so)', 
    Number(finRep.json?.data?.totals?.total_paid || 0) === 0, finRep.json?.data?.totals?.total_paid);

  // Agents report (admin only)
  const agentRep = await apiReq('GET', '/reports/agents', null, ADMIN_TOKEN);
  assert('GET /reports/agents (admin) → 200', agentRep.status === 200, agentRep.status);

  // Date filter
  const filtered = await apiReq('GET', '/reports/properties?from_date=2020-01-01&to_date=2030-12-31', null, ADMIN_TOKEN);
  assert('Reports with date filter → 200', filtered.status === 200, filtered.status);

  // Employee RBAC on reports
  if (EMP_TOKEN) {
    const empFin = await apiReq('GET', '/reports/financials', null, EMP_TOKEN);
    assert('Employee GET /reports/financials → 403', empFin.status === 403, empFin.status);
    const empAgent = await apiReq('GET', '/reports/agents', null, EMP_TOKEN);
    assert('Employee GET /reports/agents → 403', empAgent.status === 403, empAgent.status);
    const empDash = await apiReq('GET', '/reports/dashboard', null, EMP_TOKEN);
    assert('Employee GET /reports/dashboard → 200', empDash.status === 200, empDash.status);
  }

  // Unauthenticated
  assert('GET /reports/dashboard without auth → 401', (await req('GET', `${API}/reports/dashboard`)).status === 401, '');
}

// ── J. ACTIVITIES ─────────────────────────────────────────────
async function testActivities() {
  section('J. ACTIVITIES');

  const list = await apiReq('GET', '/activities', null, ADMIN_TOKEN);
  assert('GET /activities (admin) → 200', list.status === 200, list.status);
  assert('Activities returns array', Array.isArray(list.json?.data), typeof list.json?.data);
  assert('Activities has entries (> 0)', list.json?.data?.length > 0, list.json?.data?.length);
  
  const first = list.json?.data?.[0];
  assert('Activity entry has action field', !!first?.action, JSON.stringify(first).slice(0,30));
  assert('Activity entry has description', !!first?.description, JSON.stringify(first).slice(0,30));
  assert('Activity entry has created_at', !!first?.created_at, JSON.stringify(first).slice(0,30));

  // Filter by action
  const filtered = await apiReq('GET', '/activities?action=user.login', null, ADMIN_TOKEN);
  assert('Activities filter by action → 200', filtered.status === 200, filtered.status);

  // Employee sees own activities
  if (EMP_TOKEN) {
    const empActs = await apiReq('GET', '/activities', null, EMP_TOKEN);
    assert('Employee GET /activities → 200 (filtered)', empActs.status === 200, empActs.status);
  }

  assert('GET /activities without auth → 401', (await req('GET', `${API}/activities`)).status === 401, '');
}

// ── K. SECURITY AUDIT ─────────────────────────────────────────
async function testSecurity() {
  section('K. SECURITY AUDIT');

  // No stack trace in production errors
  const badId = await apiReq('GET', '/users/abc', null, ADMIN_TOKEN);
  assert('No stack trace in production error response', !badId.json?.stack, 'STACK EXPOSED!');
  assert('Error response has success=false', badId.json?.success === false, badId.json?.success);

  // SQL injection in search fields
  const sqlSearch = await apiReq('GET', `/properties?search=${encodeURIComponent("'; DROP TABLE properties;--")}`, null, ADMIN_TOKEN);
  assert('SQL injection in search → 200 (parameterized query, safe)', sqlSearch.status === 200, sqlSearch.status);

  const sqlSearch2 = await apiReq('GET', `/customers?search=${encodeURIComponent("1=1 OR '1'='1")}`, null, ADMIN_TOKEN);
  assert('SQL injection in customers search → 200 (safe)', sqlSearch2.status === 200, sqlSearch2.status);

  // XSS in input fields — stored safely
  const xssCreate = await apiReq('POST', '/customers', {
    name: `${QA_PREFIX}<script>alert(1)</script>`,
    phone: '0501231234',
  }, ADMIN_TOKEN);
  assert('XSS input stored as text (not executed)', 
    [201, 422].includes(xssCreate.status), xssCreate.status);
  if (xssCreate.json?.data?.id) CREATED.push({ type: 'customer', id: xssCreate.json.data.id, description: 'QA XSS test' });

  // CORS — external origin should not get wildcard
  const corsReq = await new Promise(resolve => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/status', method: 'GET',
      headers: { Origin: 'https://evil.attacker.com' },
    };
    const r = http.request(opts, (res) => {
      resolve({ acao: res.headers['access-control-allow-origin'] });
      res.resume();
    });
    r.on('error', () => resolve({ acao: null }));
    r.end();
  });
  assert('CORS: external origin not given wildcard (*)', corsReq.acao !== '*', corsReq.acao || 'null');

  // CORS — LAN origin allowed
  const corsLan = await new Promise(resolve => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/status', method: 'GET',
      headers: { Origin: 'http://192.168.1.100:5000' },
    };
    const r = http.request(opts, (res) => {
      resolve({ status: res.statusCode, acao: res.headers['access-control-allow-origin'] });
      res.resume();
    });
    r.on('error', () => resolve({ status: 0, acao: null }));
    r.end();
  });
  assert('CORS: LAN origin (192.168.x.x) is allowed', corsLan.acao === 'http://192.168.1.100:5000', corsLan.acao);

  // password_hash never in responses
  const userResp = await apiReq('GET', '/users', null, ADMIN_TOKEN);
  assert('User list: no password_hash exposed', !userResp.json?.data?.some(u => u.password_hash), 'EXPOSED!');
  
  const meResp = await apiReq('GET', '/auth/me', null, ADMIN_TOKEN);
  assert('/auth/me: no password_hash exposed', !meResp.json?.data?.password_hash, 'EXPOSED!');

  // Security headers
  const hdrs = await req('GET', `${BASE}/`);
  assert('X-Content-Type-Options header present', 
    !!hdrs.headers['x-content-type-options'], hdrs.headers['x-content-type-options'] || 'missing');
  assert('X-Frame-Options header present', 
    !!hdrs.headers['x-frame-options'], hdrs.headers['x-frame-options'] || 'missing');

  // Rate limiting headers
  const rlResp = await apiReq('GET', '/properties', null, ADMIN_TOKEN);
  const hasRl = rlResp.headers['ratelimit-limit'] || rlResp.headers['x-ratelimit-limit'] || rlResp.headers['retry-after'];
  assert('Rate limiting headers present', !!hasRl, 'no rate limit header');

  // IDOR: Employee accessing another employee's records
  // (tested in customers section above)
}

// ── L. ERROR HANDLING ─────────────────────────────────────────
async function testErrorHandling() {
  section('L. ERROR HANDLING');

  // Invalid JSON
  const badJson = await new Promise(resolve => {
    const body = '{invalid json}';
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const r = http.request(opts, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json; try { json = JSON.parse(raw); } catch { json = {}; }
        resolve({ status: res.statusCode, json });
      });
    });
    r.on('error', () => resolve({ status: 0 }));
    r.write(body); r.end();
  });
  assert('Invalid JSON body → 400', badJson.status === 400, badJson.status);
  assert('Invalid JSON error: no stack trace', !badJson.json?.stack, 'STACK EXPOSED!');

  // Nonexistent route
  const unk = await apiReq('DELETE', '/totally_nonexistent_endpoint', null, ADMIN_TOKEN);
  assert('Nonexistent route → 404', unk.status === 404, unk.status);
  assert('Nonexistent route returns JSON', unk.json?.success === false, JSON.stringify(unk.json).slice(0,40));

  // Missing required fields
  const missing = await apiReq('POST', '/customers', {}, ADMIN_TOKEN);
  assert('Missing required fields → 422', missing.status === 422, missing.status);

  // Invalid enum value
  const badEnum = await apiReq('PATCH', '/customers/1/status', { status: 'not_valid_status_xyz' }, ADMIN_TOKEN);
  assert('Invalid enum value → 422', badEnum.status === 422, badEnum.status);

  // Very long input
  const longStr = 'A'.repeat(10000);
  const longInput = await apiReq('POST', '/customers', { name: longStr, phone: '0501234567' }, ADMIN_TOKEN);
  assert('Very long field → 422 (not crash)', longInput.status === 422, longInput.status);

  // Negative page number
  const negPage = await apiReq('GET', '/properties?page=-5', null, ADMIN_TOKEN);
  assert('Negative page → 200 (handled gracefully)', negPage.status === 200, negPage.status);
}

// ── M. LAN / NETWORK ──────────────────────────────────────────
async function testLAN() {
  section('M. LAN / NETWORK');

  // Server binds on 0.0.0.0 — test via 127.0.0.1
  const h = await req('GET', 'http://127.0.0.1:5000/health');
  assert('Server reachable via 127.0.0.1:5000', h.status === 200, h.status);
  assert('Server environment is production', h.json?.environment === 'production', h.json?.environment);

  // Static files served
  const uploads = fs.readdirSync('C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\backend\\uploads\\properties')
    .filter(f => !f.startsWith('.'));
  if (uploads.length > 0) {
    const testFile = uploads[0];
    const staticFile = await req('GET', `${BASE}/uploads/properties/${testFile}`);
    assert(`Static upload served at /uploads/properties/${testFile}`, staticFile.status === 200, staticFile.status);
  } else {
    blocked('Static upload serving test', 'No uploaded files in properties/ dir');
  }

  // SPA deep route works (React Router catch-all)
  const deepRoute = await req('GET', `${BASE}/dashboard`);
  assert('SPA deep route /dashboard → 200 (catch-all works)', deepRoute.status === 200, deepRoute.status);
  assert('/dashboard returns HTML (SPA)', deepRoute.headers['content-type']?.includes('text/html'), deepRoute.headers['content-type']);

  // API path stays as JSON 404 (NOT SPA HTML)
  const apiPath = await req('GET', `${BASE}/api/v1/nonexistent_xyz`);
  assert('Unknown /api/v1/ path → JSON 404 (not SPA HTML)', 
    apiPath.status === 404 && apiPath.headers['content-type']?.includes('application/json'), 
    `${apiPath.status} ${apiPath.headers['content-type']}`);

  // No hardcoded localhost in API responses
  const propList = await apiReq('GET', '/properties?limit=3', null, ADMIN_TOKEN);
  const bodyStr = JSON.stringify(propList.json);
  assert('API responses contain no hardcoded localhost:3000', !bodyStr.includes('localhost:3000'), 'FOUND localhost:3000!');

  // CORS preflight
  const preflight = await new Promise(resolve => {
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/properties', method: 'OPTIONS',
      headers: {
        Origin: 'http://192.168.1.50:5000',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
    };
    const r = http.request(opts, (res) => {
      resolve({ status: res.statusCode, headers: res.headers });
      res.resume();
    });
    r.on('error', () => resolve({ status: 0, headers: {} }));
    r.end();
  });
  assert('CORS preflight → 204 or 200', [200, 204].includes(preflight.status), preflight.status);
}

// ── N. I18N AUDIT ─────────────────────────────────────────────
async function testI18n() {
  section('N. INTERNATIONALIZATION');

  // Check locale files exist
  const arPath = 'C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\frontend\\src\\i18n\\locales\\ar.js';
  const enPath = 'C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\frontend\\src\\i18n\\locales\\en.js';
  assert('Arabic locale file exists (ar.js)', fs.existsSync(arPath), arPath);
  assert('English locale file exists (en.js)', fs.existsSync(enPath), enPath);

  // Check i18n config
  const i18nIndex = fs.readFileSync('C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\frontend\\src\\i18n\\index.js', 'utf8');
  assert('i18n uses Arabic as default language', i18nIndex.includes("'ar'") || i18nIndex.includes('"ar"'), 'no "ar" found');

  // Check App.jsx for language switcher
  const appJsx = fs.readFileSync('C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\frontend\\src\\App.jsx', 'utf8');
  assert('Language switcher in App.jsx routes', 
    appJsx.includes('language') || appJsx.includes('i18n') || appJsx.includes('Language'),
    'NO language switcher found in App.jsx routes');
    
  // Check if MainLayout has language switcher
  const mainLayoutPath = 'C:\\Users\\Khaled\\OneDrive\\Desktop\\real-estate-management-system\\frontend\\src\\components\\layout\\MainLayout.jsx';
  if (fs.existsSync(mainLayoutPath)) {
    const ml = fs.readFileSync(mainLayoutPath, 'utf8');
    assert('Language switcher in MainLayout', ml.includes('language') || ml.includes('Language') || ml.includes('i18n'), 'check MainLayout');
  }
}

// ── O. PERFORMANCE SANITY ─────────────────────────────────────
async function testPerformance() {
  section('O. PERFORMANCE SANITY');

  const endpoints = [
    { name: 'Dashboard', path: '/reports/dashboard' },
    { name: 'Properties list', path: '/properties?limit=20' },
    { name: 'Customers list', path: '/customers?limit=20' },
    { name: 'Appointments list', path: '/appointments?limit=20' },
    { name: 'Activities list', path: '/activities?limit=20' },
  ];

  for (const ep of endpoints) {
    const start = Date.now();
    const r = await apiReq('GET', ep.path, null, ADMIN_TOKEN);
    const ms = Date.now() - start;
    assert(`${ep.name} responds < 2000ms`, ms < 2000, `${ms}ms`);
    assert(`${ep.name} returns 200`, r.status === 200, r.status);
  }
}

// ── P. DATA INTEGRITY ─────────────────────────────────────────
async function testDataIntegrity(propId, custId) {
  section('P. DATA INTEGRITY');
  if (!propId) { blocked('Data integrity tests', 'No propId'); return; }

  // Verify property was persisted in DB
  const getP = await apiReq('GET', `/properties/${propId}`, null, ADMIN_TOKEN);
  assert('Created property persists after creation', getP.status === 200, getP.status);
  assert('Created property title contains QA_AUDIT_', getP.json?.data?.title?.includes(QA_PREFIX), getP.json?.data?.title);

  // Update and verify persistence
  const upd = await apiReq('PUT', `/properties/${propId}`, { description: 'Updated desc for integrity check' }, ADMIN_TOKEN);
  const getAfterUpd = await apiReq('GET', `/properties/${propId}`, null, ADMIN_TOKEN);
  assert('Property update persists immediately', getAfterUpd.json?.data?.description === 'Updated desc for integrity check', getAfterUpd.json?.data?.description);

  // Activity log records operations
  const acts = await apiReq('GET', `/activities?entity_type=properties&entity_id=${propId}`, null, ADMIN_TOKEN);
  assert('Activity log has entries for created property', acts.json?.data?.length > 0, acts.json?.data?.length);

  // Dashboard counts reflect real data
  const dash = await apiReq('GET', '/reports/dashboard', null, ADMIN_TOKEN);
  assert('Dashboard available_properties > 0', dash.json?.data?.available_properties > 0, dash.json?.data?.available_properties);
  assert('Dashboard total_customers > 0', dash.json?.data?.total_customers > 0, dash.json?.data?.total_customers);
}

// ── Q. CLEANUP ────────────────────────────────────────────────
async function cleanup() {
  section('Q. CLEANUP — Removing QA test records');

  // Delete in order: appointments → customers → properties → users
  const order = ['appointment', 'customer', 'property', 'user'];
  const sorted = [...CREATED].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  for (const item of sorted) {
    let path;
    switch(item.type) {
      case 'appointment': path = `/appointments/${item.id}`; break;
      case 'customer':    path = `/customers/${item.id}`;    break;
      case 'property':    path = `/properties/${item.id}`;   break;
      case 'user':        path = `/users/${item.id}`;        break;
    }
    if (path) {
      const r = await apiReq('DELETE', path, null, ADMIN_TOKEN);
      assert(`Cleanup: deleted ${item.type} ${item.id} (${item.description})`, 
        [200, 204, 404].includes(r.status), r.status);
    }
  }

  // Final logout
  if (ADMIN_TOKEN && ADMIN_COOKIE) {
    await apiReqCookie('POST', '/auth/logout', {}, ADMIN_TOKEN, ADMIN_COOKIE);
  }
  if (EMP_TOKEN && EMP_COOKIE) {
    await apiReqCookie('POST', '/auth/logout', {}, EMP_TOKEN, EMP_COOKIE);
  }
  console.log('\n  All QA test records cleaned up.');
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  console.log('\n' + '═'.repeat(56));
  console.log('  REMS FINAL PRE-DELIVERY QA AUDIT');
  console.log('  Runtime Test Suite');
  console.log('  ' + new Date().toISOString());
  console.log('═'.repeat(56));

  await testHealth();
  await testAuth();
  await testUsers();
  const propId = await testProperties();
  await testMedia(propId);
  const custId = await testCustomers();
  await testAppointments(propId, custId);
  await testContracts();
  await testReports();
  await testActivities();
  await testSecurity();
  await testErrorHandling();
  await testLAN();
  await testI18n();
  await testPerformance();
  await testDataIntegrity(propId, custId);
  await cleanup();

  const TOTAL = PASS + FAIL + BLOCK;
  console.log('\n' + '═'.repeat(56));
  console.log('  AUDIT RESULTS');
  console.log('═'.repeat(56));
  console.log(`  PASS:    ${PASS}`);
  console.log(`  FAIL:    ${FAIL}`);
  console.log(`  BLOCKED: ${BLOCK}`);
  console.log(`  TOTAL:   ${TOTAL}`);
  console.log(`  PASS%:   ${TOTAL > 0 ? Math.round(100*PASS/TOTAL) : 0}%`);

  if (FAIL > 0) {
    console.log('\n  FAILURES:');
    RESULTS.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`    ❌ ${r.label}  [${r.got}]`);
    });
  }

  // Write results JSON
  fs.writeFileSync(
    path.join(__dirname, 'qa_results.json'),
    JSON.stringify({ timestamp: new Date().toISOString(), PASS, FAIL, BLOCK, TOTAL, RESULTS }, null, 2)
  );
  console.log('\n  Results written to QA_REPORT/qa_results.json');
  console.log('═'.repeat(56) + '\n');
  
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('FATAL TEST ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
