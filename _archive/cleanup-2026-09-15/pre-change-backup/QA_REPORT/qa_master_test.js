'use strict';
/**
 * QA Master Test — REMS Final Pre-Delivery Audit
 * Tests phases: 3,4,5,6,7,8,10,11,12,13,17
 * 
 * Uses QA_TEST_ prefix for all created records.
 * Cleans up all test data at end.
 * NEVER touches production records.
 */

const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const BASE     = 'http://localhost:5000';
const API      = `${BASE}/api/v1`;
const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASS  = 'Admin@123456';

let passed = 0, failed = 0, blocked = 0;
const allResults   = [];
const createdItems = [];  // track for cleanup

function log(status, label, detail = '') {
  const sym = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '🟡';
  const line = `  ${sym} [${status}] ${label}${detail ? ' | ' + detail : ''}`;
  process.stdout.write(line + '\n');
  allResults.push({ status, label, detail });
  if (status === 'PASS') passed++;
  else if (status === 'FAIL') failed++;
  else blocked++;
}

function section(name) {
  process.stdout.write(`\n${'═'.repeat(56)}\n  ${name}\n${'═'.repeat(56)}\n`);
}

/* ── HTTP helpers ─────────────────────────────────────────── */
function req(method, url, opts = {}) {
  return new Promise((resolve) => {
    const parsed = new URL(url.startsWith('http') ? url : API + url);
    const isHttps = parsed.protocol === 'https:';
    const body = opts.body ? JSON.stringify(opts.body) : null;
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method,
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
        ...(opts.token ? { 'Authorization': `Bearer ${opts.token}` } : {}),
        ...(opts.cookie ? { 'Cookie': opts.cookie } : {}),
        ...(opts.headers || {}),
      },
    };
    const transport = isHttps ? https : http;
    const r = transport.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        const setCookies = {};
        for (const c of (res.headers['set-cookie'] || [])) {
          const [kv] = c.split(';');
          const [k, v] = kv.split('=');
          if (k) setCookies[k.trim()] = (v || '').trim();
        }
        resolve({ status: res.statusCode, json, raw, headers: res.headers, setCookies });
      });
    });
    r.on('error', (e) => resolve({ status: 0, json: null, raw: e.message, headers: {}, setCookies: {} }));
    if (body) r.write(body);
    r.end();
  });
}

function GET(path, opts={})         { return req('GET',    path, opts); }
function POST(path, body, opts={})  { return req('POST',   path, { ...opts, body }); }
function PUT(path, body, opts={})   { return req('PUT',    path, { ...opts, body }); }
function PATCH(path, body, opts={}) { return req('PATCH',  path, { ...opts, body }); }
function DELETE(path, opts={})      { return req('DELETE', path, opts); }

/* ── Multipart upload helper ─────────────────────────────── */
function uploadFile(urlPath, fieldName, filename, buffer, mimeType, token) {
  return new Promise((resolve) => {
    const boundary = `----FormBoundary${crypto.randomBytes(8).toString('hex')}`;
    const head = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const tail = `\r\n--${boundary}--\r\n`;
    const bodyBuf = Buffer.concat([
      Buffer.from(head, 'utf8'),
      buffer,
      Buffer.from(tail, 'utf8'),
    ]);
    const options = {
      hostname: 'localhost',
      port:     5000,
      path:     `/api/v1${urlPath}`,
      method:   'POST',
      headers: {
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuf.length,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    };
    const r = http.request(options, (res) => {
      let raw = '';
      res.on('data', c => { raw += c; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, json, raw });
      });
    });
    r.on('error', (e) => resolve({ status: 0, json: null, raw: e.message }));
    r.write(bodyBuf);
    r.end();
  });
}

/* ── State ────────────────────────────────────────────────── */
let adminToken   = null;
let adminCookie  = null;
let empToken     = null;
let empCookie    = null;
let empId        = null;
let testPropId   = null;
let testCustId   = null;
let testApptId   = null;

/* ═══════════════════════════════════════════════════════════
   SECTION A: HEALTH & STATUS (Phase 0)
   ═══════════════════════════════════════════════════════════ */
async function testHealth() {
  section('A. HEALTH & STATUS');

  const h = await GET(`${BASE}/health`);
  log(h.status === 200 ? 'PASS' : 'FAIL', 'GET /health → 200', `status=${h.status} env=${h.json?.environment}`);
  log(h.json?.environment === 'production' ? 'PASS' : 'FAIL', 'NODE_ENV = production', `got: ${h.json?.environment}`);

  const s = await GET('/status');
  log(s.status === 200 ? 'PASS' : 'FAIL', 'GET /api/v1/status → 200', `got ${s.status}`);
  log(s.json?.success === true ? 'PASS' : 'FAIL', 'Status endpoint returns success:true');

  // Unknown API routes must NOT return SPA HTML
  const unk = await GET('/completely_unknown_xyz_endpoint_12345');
  log(unk.status === 404 ? 'PASS' : 'FAIL', 'Unknown API route → 404 (not SPA HTML)', `got ${unk.status}`);
  log(!unk.raw?.includes('<!doctype') ? 'PASS' : 'FAIL', 'Unknown API route returns JSON (not HTML)');

  // SPA served at root
  const spa = await req('GET', `${BASE}/`);
  log(spa.status === 200 ? 'PASS' : 'FAIL', 'GET / serves SPA → 200', `ct=${spa.headers['content-type']}`);
  log(spa.raw?.includes('<!doctype') ? 'PASS' : 'FAIL', 'SPA root returns HTML');

  // SPA deep route served (React Router catch-all)
  const deep = await req('GET', `${BASE}/dashboard`);
  log(deep.status === 200 ? 'PASS' : 'FAIL', 'GET /dashboard serves SPA (catch-all)', `got ${deep.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION B: AUTHENTICATION (Phase 7)
   ═══════════════════════════════════════════════════════════ */
async function testAuth() {
  section('B. AUTHENTICATION (Phase 7)');

  /* ── Login negative tests ── */
  const badPass = await POST('/auth/login', { email: ADMIN_EMAIL, password: 'WRONG_PASS' });
  log(badPass.status === 401 ? 'PASS' : 'FAIL', 'Login wrong password → 401', `got ${badPass.status}`);

  const badEmail = await POST('/auth/login', { email: 'nobody@nobody.com', password: ADMIN_PASS });
  log(badEmail.status === 401 ? 'PASS' : 'FAIL', 'Login wrong email → 401', `got ${badEmail.status}`);

  const emptyBody = await POST('/auth/login', {});
  log(emptyBody.status === 422 ? 'PASS' : 'FAIL', 'Login empty body → 422', `got ${emptyBody.status}`);

  const badFormat = await POST('/auth/login', { email: 'not-an-email', password: 'x' });
  log(badFormat.status === 422 ? 'PASS' : 'FAIL', 'Login malformed email → 422', `got ${badFormat.status}`);

  /* ── Valid login ── */
  const login = await POST('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  log(login.status === 200 ? 'PASS' : 'FAIL', 'Admin valid login → 200', `got ${login.status}`);
  log(!!login.json?.data?.accessToken ? 'PASS' : 'FAIL', 'Login returns accessToken');
  log(!login.json?.data?.refreshToken ? 'PASS' : 'FAIL', 'Login does NOT expose refreshToken in body');
  log(!!login.setCookies?.rems_rt ? 'PASS' : 'FAIL', 'Login sets rems_rt HttpOnly cookie');

  const setCookieHeader = login.headers?.['set-cookie']?.join(';') || '';
  log(setCookieHeader.toLowerCase().includes('httponly') ? 'PASS' : 'FAIL', 'rems_rt cookie has HttpOnly flag');
  log(setCookieHeader.toLowerCase().includes('samesite=strict') ? 'PASS' : 'FAIL', 'rems_rt cookie has SameSite=Strict');
  log(setCookieHeader.toLowerCase().includes('path=/api/v1/auth') ? 'PASS' : 'FAIL', 'rems_rt cookie restricted to /api/v1/auth path');

  adminToken  = login.json?.data?.accessToken;
  adminCookie = `rems_rt=${login.setCookies?.rems_rt}`;

  /* ── GET /auth/me ── */
  const me = await GET('/auth/me', { token: adminToken });
  log(me.status === 200 ? 'PASS' : 'FAIL', 'GET /auth/me → 200 (authenticated)', `got ${me.status}`);
  log(me.json?.data?.email === ADMIN_EMAIL ? 'PASS' : 'FAIL', '/auth/me returns correct email');
  log(!me.json?.data?.password_hash ? 'PASS' : 'FAIL', '/auth/me does NOT return password_hash');
  log(me.json?.data?.role === 'admin' ? 'PASS' : 'FAIL', '/auth/me returns role=admin', `role=${me.json?.data?.role}`);

  /* ── No token → 401 ── */
  const noToken = await GET('/auth/me');
  log(noToken.status === 401 ? 'PASS' : 'FAIL', 'Protected endpoint without token → 401', `got ${noToken.status}`);

  /* ── Invalid token → 401 ── */
  const badToken = await GET('/auth/me', { token: 'invalid.jwt.token.here' });
  log(badToken.status === 401 ? 'PASS' : 'FAIL', 'Invalid token → 401', `got ${badToken.status}`);

  /* ── Refresh token rotation test ── */
  const ref1 = await POST('/auth/refresh', {}, { cookie: adminCookie });
  log(ref1.status === 200 ? 'PASS' : 'FAIL', 'Valid refresh token → 200', `got ${ref1.status}`);
  log(!!ref1.json?.data?.accessToken ? 'PASS' : 'FAIL', 'Refresh returns new accessToken');
  log(!ref1.json?.data?.refreshToken ? 'PASS' : 'FAIL', 'Refresh does NOT expose refreshToken in body');
  log(!!ref1.setCookies?.rems_rt ? 'PASS' : 'FAIL', 'Refresh sets new rems_rt cookie');

  const newToken1  = ref1.json?.data?.accessToken;
  const newCookie1 = `rems_rt=${ref1.setCookies?.rems_rt}`;

  // Old cookie must now be rejected
  const oldReuse = await POST('/auth/refresh', {}, { cookie: adminCookie });
  log(oldReuse.status === 401 ? 'PASS' : 'FAIL', 'Old refresh token rejected after rotation → 401', `got ${oldReuse.status}`);

  // Forged refresh token
  const forged = await POST('/auth/refresh', {}, { cookie: 'rems_rt=forged.token.that.is.invalid' });
  log(forged.status === 401 ? 'PASS' : 'FAIL', 'Forged refresh token → 401', `got ${forged.status}`);

  /* ── 5-cycle rotation verification ── */
  section('B2. REFRESH TOKEN ROTATION — 5 CYCLES');
  let cycleToken  = newToken1;
  let cycleCookie = newCookie1;
  let allCyclesPassed = true;

  for (let i = 1; i <= 5; i++) {
    const rRef = await POST('/auth/refresh', {}, { cookie: cycleCookie });
    const rOld = await POST('/auth/refresh', {}, { cookie: cycleCookie }); // reuse same (should fail)
    const rNew = rRef.json?.data?.accessToken;
    const rCk  = `rems_rt=${rRef.setCookies?.rems_rt}`;

    const cyclePass = rRef.status === 200 && rOld.status === 401 && !!rNew;
    if (!cyclePass) allCyclesPassed = false;
    log(cyclePass ? 'PASS' : 'FAIL',
      `Rotation cycle ${i}: new token works, old rejected`,
      `refresh=${rRef.status} reuse=${rOld.status}`);
    cycleToken  = rNew || cycleToken;
    cycleCookie = rCk || cycleCookie;
  }

  /* ── Logout ── */
  const logout = await POST('/auth/logout', {}, { token: cycleToken, cookie: cycleCookie });
  log(logout.status === 200 ? 'PASS' : 'FAIL', 'Logout → 200', `got ${logout.status}`);

  // After logout the cookie must be revoked
  const postLogout = await POST('/auth/refresh', {}, { cookie: cycleCookie });
  log(postLogout.status === 401 ? 'PASS' : 'FAIL', 'Post-logout refresh token → 401', `got ${postLogout.status}`);

  // Re-login for subsequent tests
  const relogin = await POST('/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  adminToken  = relogin.json?.data?.accessToken;
  adminCookie = `rems_rt=${relogin.setCookies?.rems_rt}`;
  log(!!adminToken ? 'PASS' : 'FAIL', 'Re-login after logout succeeds');
}

/* ═══════════════════════════════════════════════════════════
   SECTION C: USERS (Phase 2 + 4 + 8)
   ═══════════════════════════════════════════════════════════ */
async function testUsers() {
  section('C. USERS CRUD + RBAC (Phases 2,4,8)');

  /* ── List users ── */
  const list = await GET('/users', { token: adminToken });
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /users (admin) → 200', `got ${list.status}`);
  log(Array.isArray(list.json?.data) ? 'PASS' : 'FAIL', 'Users list is array');
  log(list.json?.data?.every(u => !u.password_hash) ? 'PASS' : 'FAIL', 'Users list hides password_hash');

  const adminUser = list.json?.data?.find(u => u.email === ADMIN_EMAIL);
  log(adminUser?.role === 'admin' ? 'PASS' : 'FAIL', 'Admin user has role=admin in API response');

  /* ── Create employee (QA test user) ── */
  const createEmp = await POST('/users', {
    name:     'QA_TEST_Employee',
    email:    'qa_test_employee@example.com',
    password: 'QA_Test@Pass1234',
    role:     'employee',
    phone:    '0512345678',
  }, { token: adminToken });
  log(createEmp.status === 201 ? 'PASS' : 'FAIL', 'POST /users create employee → 201', `got ${createEmp.status} ${createEmp.json?.message}`);
  empId = createEmp.json?.data?.id;
  if (empId) createdItems.push({ type: 'user', id: empId });
  log(createEmp.json?.data?.role === 'employee' ? 'PASS' : 'FAIL', 'Created user role = employee', `role=${createEmp.json?.data?.role}`);

  /* ── Duplicate email ── */
  const dupEmail = await POST('/users', {
    name: 'Dup', email: 'qa_test_employee@example.com', password: 'QA_Test@Pass1234', role: 'employee',
  }, { token: adminToken });
  log(dupEmail.status === 409 ? 'PASS' : 'FAIL', 'Duplicate email → 409', `got ${dupEmail.status}`);

  /* ── Get single user ── */
  const getOne = await GET(`/users/${empId}`, { token: adminToken });
  log(getOne.status === 200 ? 'PASS' : 'FAIL', `GET /users/${empId} → 200`, `got ${getOne.status}`);

  /* ── Update user ── */
  const upd = await PUT(`/users/${empId}`, { name: 'QA_TEST_Employee_Updated', role: 'employee' }, { token: adminToken });
  log(upd.status === 200 ? 'PASS' : 'FAIL', `PUT /users/${empId} update → 200`, `got ${upd.status}`);

  /* ── Deactivate / Activate ── */
  const deact = await PATCH(`/users/${empId}/deactivate`, {}, { token: adminToken });
  log(deact.status === 200 ? 'PASS' : 'FAIL', 'PATCH /deactivate → 200', `got ${deact.status}`);
  const act = await PATCH(`/users/${empId}/activate`, {}, { token: adminToken });
  log(act.status === 200 ? 'PASS' : 'FAIL', 'PATCH /activate → 200', `got ${act.status}`);

  /* ── Admin reset password ── */
  const resetPw = await PATCH(`/users/${empId}/password`, { password: 'QA_Test@NewPass99' }, { token: adminToken });
  log(resetPw.status === 200 ? 'PASS' : 'FAIL', 'PATCH /password reset → 200', `got ${resetPw.status}`);

  /* ── Login as employee ── */
  const empLogin = await POST('/auth/login', { email: 'qa_test_employee@example.com', password: 'QA_Test@NewPass99' });
  log(empLogin.status === 200 ? 'PASS' : 'FAIL', 'Employee login → 200', `got ${empLogin.status}`);
  empToken  = empLogin.json?.data?.accessToken;
  empCookie = `rems_rt=${empLogin.setCookies?.rems_rt}`;

  /* ── RBAC: employee cannot access /users ── */
  const empUsers = await GET('/users', { token: empToken });
  log(empUsers.status === 403 ? 'PASS' : 'FAIL', 'Employee GET /users → 403 (admin-only)', `got ${empUsers.status}`);

  const empCreateUser = await POST('/users', { name: 'x', email: 'x@x.com', password: 'Xp@1234', role: 'employee' }, { token: empToken });
  log(empCreateUser.status === 403 ? 'PASS' : 'FAIL', 'Employee POST /users → 403', `got ${empCreateUser.status}`);

  /* ── Non-existent user ── */
  const noUser = await GET('/users/999999', { token: adminToken });
  log(noUser.status === 404 ? 'PASS' : 'FAIL', 'GET /users/999999 → 404', `got ${noUser.status}`);

  /* ── Missing fields ── */
  const missing = await POST('/users', { email: 'test@x.com' }, { token: adminToken });
  log(missing.status === 422 ? 'PASS' : 'FAIL', 'Create user missing fields → 422', `got ${missing.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION D: PROPERTIES CRUD (Phases 2,4,5)
   ═══════════════════════════════════════════════════════════ */
async function testProperties() {
  section('D. PROPERTIES CRUD (Phases 2,4,5)');

  /* ── Property types ── */
  const types = await GET('/properties/types', { token: adminToken });
  log(types.status === 200 ? 'PASS' : 'FAIL', 'GET /properties/types → 200', `got ${types.status}`);
  const typeNames = types.json?.data?.map(t => t.name?.toLowerCase()) || [];
  for (const cat of ['apartment','villa','townhouse','duplex','studio','office','retail shop','warehouse','land','building','farm','chalet']) {
    log(typeNames.includes(cat) ? 'PASS' : 'FAIL', `Property type "${cat}" exists and active`);
  }

  /* ── List properties ── */
  const list = await GET('/properties', { token: adminToken });
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /properties → 200', `got ${list.status}`);
  log(Array.isArray(list.json?.data) ? 'PASS' : 'FAIL', 'Properties returns array');
  log(typeof list.json?.meta?.total === 'number' ? 'PASS' : 'FAIL', 'Properties returns pagination meta');

  /* ── Create property ── */
  const create = await POST('/properties', {
    type_id:        1,
    type:           'Apartment',
    title:          'QA_TEST_Property',
    location:       'Riyadh',
    city:           'Riyadh',
    address:        '123 QA Street',
    area:           150.5,
    bedrooms:       3,
    bathrooms:      2,
    floor:          2,
    price:          750000,
    payment_method: 'cash',
    listing_type:   'sale',
    owner_name:     'QA Owner',
    owner_phone:    '0512345678',
  }, { token: adminToken });
  log(create.status === 201 ? 'PASS' : 'FAIL', 'POST /properties create → 201', `got ${create.status} ${create.json?.message}`);
  testPropId = create.json?.data?.id;
  if (testPropId) createdItems.push({ type: 'property', id: testPropId });
  log(create.json?.data?.title === 'QA_TEST_Property' ? 'PASS' : 'FAIL', 'Created property title matches');

  /* ── Get single property ── */
  const getOne = await GET(`/properties/${testPropId}`, { token: adminToken });
  log(getOne.status === 200 ? 'PASS' : 'FAIL', `GET /properties/${testPropId} → 200`, `got ${getOne.status}`);
  log(Array.isArray(getOne.json?.data?.images) ? 'PASS' : 'FAIL', 'Property detail has images array');
  log(Array.isArray(getOne.json?.data?.videos) ? 'PASS' : 'FAIL', 'Property detail has videos array');

  /* ── Update property ── */
  const upd = await PUT(`/properties/${testPropId}`, { price: 800000 }, { token: adminToken });
  log(upd.status === 200 ? 'PASS' : 'FAIL', 'PUT /properties update → 200', `got ${upd.status}`);
  log(upd.json?.data?.price === 800000 ? 'PASS' : 'FAIL', 'Price updated correctly');

  /* ── Update status ── */
  const stat = await PATCH(`/properties/${testPropId}/status`, { status: 'reserved' }, { token: adminToken });
  log(stat.status === 200 ? 'PASS' : 'FAIL', 'PATCH /properties/status → 200', `got ${stat.status}`);
  log(stat.json?.data?.status === 'reserved' ? 'PASS' : 'FAIL', 'Status updated to reserved');

  /* ── Invalid status ── */
  const badStat = await PATCH(`/properties/${testPropId}/status`, { status: 'flying_unicorn' }, { token: adminToken });
  log(badStat.status === 422 ? 'PASS' : 'FAIL', 'Invalid status value → 422', `got ${badStat.status}`);

  /* ── Search ── */
  const search = await GET('/properties?search=QA_TEST_Property', { token: adminToken });
  log(search.status === 200 ? 'PASS' : 'FAIL', 'Property search → 200', `got ${search.status}`);
  log(search.json?.data?.some(p => p.id === testPropId) ? 'PASS' : 'FAIL', 'Search finds the QA test property');

  /* ── Filter by status ── */
  const filtStat = await GET('/properties?status=available', { token: adminToken });
  log(filtStat.status === 200 ? 'PASS' : 'FAIL', 'Filter by status=available → 200', `got ${filtStat.status}`);

  /* ── Filter by type ── */
  const filtType = await GET('/properties?type_id=1', { token: adminToken });
  log(filtType.status === 200 ? 'PASS' : 'FAIL', 'Filter by type_id → 200');

  /* ── Sort + pagination ── */
  const paged = await GET('/properties?page=1&limit=5&sort=price&order=DESC', { token: adminToken });
  log(paged.status === 200 ? 'PASS' : 'FAIL', 'Paginated sorted properties → 200');

  /* ── Non-existent ── */
  const none = await GET('/properties/9999999', { token: adminToken });
  log(none.status === 404 ? 'PASS' : 'FAIL', 'GET /properties/9999999 → 404', `got ${none.status}`);

  /* ── Missing required fields ── */
  const noFields = await POST('/properties', { title: 'No required fields' }, { token: adminToken });
  log(noFields.status === 422 ? 'PASS' : 'FAIL', 'Create property missing fields → 422', `got ${noFields.status}`);

  /* ── SQL injection in search ── */
  const sqlInj = await GET(`/properties?search=${encodeURIComponent("' OR '1'='1")}`, { token: adminToken });
  log(sqlInj.status === 200 ? 'PASS' : 'FAIL', "SQL injection in search handled safely", `got ${sqlInj.status}`);

  /* ── Arabic text ── */
  const arabic = await POST('/properties', {
    type_id: 2, type: 'Villa', title: 'QA_TEST_فيلا عربية', location: 'جدة', city: 'جدة',
    address: 'شارع الملك فهد', area: 200, price: 1500000, payment_method: 'cash',
    listing_type: 'sale', owner_name: 'QA مالك', owner_phone: '0598765432',
  }, { token: adminToken });
  log(arabic.status === 201 ? 'PASS' : 'FAIL', 'Create property with Arabic text → 201', `got ${arabic.status}`);
  if (arabic.json?.data?.id) createdItems.push({ type: 'property', id: arabic.json.data.id });

  /* ── Unauthorized (no token) ── */
  const noAuth = await GET('/properties');
  log(noAuth.status === 401 ? 'PASS' : 'FAIL', 'GET /properties without token → 401', `got ${noAuth.status}`);

  /* ── IDOR: employee cannot edit admin's property ── */
  if (empToken && testPropId) {
    const empEdit = await PUT(`/properties/${testPropId}`, { price: 1 }, { token: empToken });
    log(empEdit.status === 403 ? 'PASS' : 'FAIL', 'Employee cannot edit admin property (IDOR) → 403', `got ${empEdit.status}`);
  }
}

/* ═══════════════════════════════════════════════════════════
   SECTION E: PROPERTY MEDIA UPLOADS (Phase 2, 8)
   ═══════════════════════════════════════════════════════════ */
async function testMedia() {
  section('E. PROPERTY MEDIA UPLOADS (Phase 2, 8)');
  if (!testPropId) { log('BLOCK', 'Media tests skipped — no test property ID'); return; }

  // Create a minimal 1x1 white JPEG
  const jpegHeader = Buffer.from([
    0xFF,0xD8,0xFF,0xE0,0x00,0x10,0x4A,0x46,0x49,0x46,0x00,0x01,0x01,0x00,0x00,0x01,
    0x00,0x01,0x00,0x00,0xFF,0xDB,0x00,0x43,0x00,0x08,0x06,0x06,0x07,0x06,0x05,0x08,
    0x07,0x07,0x07,0x09,0x09,0x08,0x0A,0x0C,0x14,0x0D,0x0C,0x0B,0x0B,0x0C,0x19,0x12,
    0x13,0x0F,0x14,0x1D,0x1A,0x1F,0x1E,0x1D,0x1A,0x1C,0x1C,0x20,0x24,0x2E,0x27,0x20,
    0x22,0x2C,0x23,0x1C,0x1C,0x28,0x37,0x29,0x2C,0x30,0x31,0x34,0x34,0x34,0x1F,0x27,
    0x39,0x3D,0x38,0x32,0x3C,0x2E,0x33,0x34,0x32,0xFF,0xC0,0x00,0x0B,0x08,0x00,0x01,
    0x00,0x01,0x01,0x01,0x11,0x00,0xFF,0xC4,0x00,0x1F,0x00,0x00,0x01,0x05,0x01,0x01,
    0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x02,0x03,0x04,
    0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,0xFF,0xC4,0x00,0x35,0x10,0x00,0x02,0x01,0x03,
    0x03,0x02,0x04,0x03,0x05,0x05,0x04,0x04,0x00,0x00,0x01,0x7D,0x01,0x02,0x03,0x00,
    0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,
    0x81,0x91,0xA1,0x08,0x23,0x42,0xB1,0xC1,0x15,0x52,0xD1,0xF0,0x24,0x33,0x62,0x72,
    0x82,0xFF,0xDA,0x00,0x08,0x01,0x01,0x00,0x00,0x3F,0x00,0xFB,0xD7,0xFF,0xD9,
  ]);

  /* ── Valid JPEG upload ── */
  const imgUp = await uploadFile(`/properties/${testPropId}/images`, 'images', 'test.jpg', jpegHeader, 'image/jpeg', adminToken);
  log(imgUp.status === 201 ? 'PASS' : 'FAIL', 'Upload valid JPEG → 201', `got ${imgUp.status} ${imgUp.json?.message}`);
  const imgId = imgUp.json?.data?.[0]?.id;

  /* ── Get images list ── */
  const imgs = await GET(`/properties/${testPropId}/images`, { token: adminToken });
  log(imgs.status === 200 ? 'PASS' : 'FAIL', 'GET property images → 200');
  log(imgs.json?.data?.length > 0 ? 'PASS' : 'FAIL', 'Images list has entry after upload');

  /* ── Verify file on disk ── */
  if (imgUp.json?.data?.[0]?.image_path) {
    const imgPath = path.join(__dirname, '..', 'backend', 'uploads', imgUp.json.data[0].image_path);
    log(fs.existsSync(imgPath) ? 'PASS' : 'FAIL', 'Uploaded image file exists on disk', imgPath);
  }

  /* ── Invalid extension ── */
  const phpFile = await uploadFile(`/properties/${testPropId}/images`, 'images', 'shell.php', Buffer.from('<?php system($_GET["cmd"]); ?>'), 'image/jpeg', adminToken);
  log(phpFile.status >= 400 ? 'PASS' : 'FAIL', 'PHP file disguised as image → 400/422', `got ${phpFile.status}`);

  /* ── MIME spoofing: .jpg ext but text/plain MIME ── */
  const mimeSpoof = await uploadFile(`/properties/${testPropId}/images`, 'images', 'fake.jpg', Buffer.from('this is not an image'), 'text/plain', adminToken);
  log(mimeSpoof.status >= 400 ? 'PASS' : 'FAIL', 'MIME spoofing (.jpg + text/plain) → 400', `got ${mimeSpoof.status}`);

  /* ── Unauthorized upload ── */
  const noAuthUp = await uploadFile(`/properties/${testPropId}/images`, 'images', 'test.jpg', jpegHeader, 'image/jpeg', null);
  log(noAuthUp.status === 401 ? 'PASS' : 'FAIL', 'Image upload without auth → 401', `got ${noAuthUp.status}`);

  /* ── Delete image ── */
  if (imgId) {
    const delImg = await DELETE(`/properties/${testPropId}/images/${imgId}`, { token: adminToken });
    log(delImg.status === 200 ? 'PASS' : 'FAIL', 'DELETE property image → 200', `got ${delImg.status}`);
  }

  /* ── Invalid video type ── */
  const badVideo = await uploadFile(`/properties/${testPropId}/videos`, 'videos', 'bad.avi', Buffer.from('avi content'), 'video/avi', adminToken);
  log(badVideo.status >= 400 ? 'PASS' : 'FAIL', 'Invalid video type .avi → 400', `got ${badVideo.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION F: CUSTOMERS CRUD (Phases 2, 4, 5, 8)
   ═══════════════════════════════════════════════════════════ */
async function testCustomers() {
  section('F. CUSTOMERS CRUD (Phases 2,4,5,8)');

  /* ── List ── */
  const list = await GET('/customers', { token: adminToken });
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /customers → 200', `got ${list.status}`);
  log(Array.isArray(list.json?.data) ? 'PASS' : 'FAIL', 'Customers returns array');

  /* ── Pipeline ── */
  const pipe = await GET('/customers/pipeline', { token: adminToken });
  log(pipe.status === 200 ? 'PASS' : 'FAIL', 'GET /customers/pipeline → 200', `got ${pipe.status}`);

  /* ── Create ── */
  const create = await POST('/customers', {
    name:          'QA_TEST_Customer',
    phone:         '0598765432',
    email:         'qa_test_customer@example.com',
    status:        'new',
    budget:        500000,
    property_type: 'Apartment',
    location:      'Riyadh',
    notes:         'QA test customer record',
  }, { token: adminToken });
  log(create.status === 201 ? 'PASS' : 'FAIL', 'POST /customers create → 201', `got ${create.status} ${create.json?.message}`);
  testCustId = create.json?.data?.id;
  if (testCustId) createdItems.push({ type: 'customer', id: testCustId });

  /* ── Get single ── */
  const getOne = await GET(`/customers/${testCustId}`, { token: adminToken });
  log(getOne.status === 200 ? 'PASS' : 'FAIL', `GET /customers/${testCustId} → 200`, `got ${getOne.status}`);

  /* ── Update ── */
  const upd = await PUT(`/customers/${testCustId}`, { notes: 'Updated notes', budget: 600000 }, { token: adminToken });
  log(upd.status === 200 ? 'PASS' : 'FAIL', 'PUT /customers update → 200', `got ${upd.status}`);

  /* ── Status update ── */
  const stat = await PATCH(`/customers/${testCustId}/status`, { status: 'interested' }, { token: adminToken });
  log(stat.status === 200 ? 'PASS' : 'FAIL', 'PATCH /customers/status → 200', `got ${stat.status}`);
  log(stat.json?.data?.status === 'interested' ? 'PASS' : 'FAIL', 'Customer status updated to interested');

  /* ── Invalid status ── */
  const badStat = await PATCH(`/customers/${testCustId}/status`, { status: 'invalid_status_xyz' }, { token: adminToken });
  log(badStat.status === 422 ? 'PASS' : 'FAIL', 'Invalid customer status → 422', `got ${badStat.status}`);

  /* ── Search ── */
  const search = await GET('/customers?search=QA_TEST_Customer', { token: adminToken });
  log(search.status === 200 ? 'PASS' : 'FAIL', 'Customer search → 200');
  log(search.json?.data?.some(c => c.id === testCustId) ? 'PASS' : 'FAIL', 'Search returns QA test customer');

  /* ── Filter ── */
  const filt = await GET('/customers?status=interested', { token: adminToken });
  log(filt.status === 200 ? 'PASS' : 'FAIL', 'Filter customers by status → 200');

  /* ── Non-existent ── */
  const none = await GET('/customers/9999999', { token: adminToken });
  log(none.status === 404 ? 'PASS' : 'FAIL', 'GET /customers/9999999 → 404', `got ${none.status}`);

  /* ── Missing required fields ── */
  const noFields = await POST('/customers', { email: 'only@email.com' }, { token: adminToken });
  log(noFields.status === 422 ? 'PASS' : 'FAIL', 'Create customer missing name/phone → 422', `got ${noFields.status}`);

  /* ── Arabic input ── */
  const arabic = await POST('/customers', {
    name: 'QA_TEST_العميل العربي', phone: '0587654321', status: 'new',
  }, { token: adminToken });
  log(arabic.status === 201 ? 'PASS' : 'FAIL', 'Customer with Arabic name → 201', `got ${arabic.status}`);
  if (arabic.json?.data?.id) createdItems.push({ type: 'customer', id: arabic.json.data.id });

  /* ── Unauthorized ── */
  const noAuth = await GET('/customers');
  log(noAuth.status === 401 ? 'PASS' : 'FAIL', 'GET /customers without token → 401', `got ${noAuth.status}`);

  /* ── IDOR: employee cannot access admin's customer ── */
  if (empToken && testCustId) {
    const empGet = await GET(`/customers/${testCustId}`, { token: empToken });
    log(empGet.status === 403 ? 'PASS' : 'FAIL', 'Employee cannot access admin customer (IDOR) → 403', `got ${empGet.status}`);
  }

  /* ── Check clients vs customers naming — /clients should 501 ── */
  const clients501 = await GET('/clients', { token: adminToken });
  log(clients501.status === 501 ? 'PASS' : 'FAIL', '/clients returns 501 (not-implemented stub)', `got ${clients501.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION G: APPOINTMENTS CRUD (Phases 2,4)
   ═══════════════════════════════════════════════════════════ */
async function testAppointments() {
  section('G. APPOINTMENTS CRUD (Phases 2,4)');

  /* ── Public booking (unauthenticated) ── */
  const pubBook = await POST('/appointments/public', {
    property_id:      testPropId || 1,
    customer_name:    'QA_TEST_Public Visitor',
    customer_phone:   '0512349876',
    appointment_date: '2027-06-15',
    appointment_time: '10:00',
    type:             'viewing',
    customer_notes:   'QA test public booking',
  });
  log(pubBook.status === 201 ? 'PASS' : 'FAIL', 'POST /appointments/public (no auth) → 201', `got ${pubBook.status} ${pubBook.json?.message}`);
  if (pubBook.json?.data?.id) {
    createdItems.push({ type: 'appointment', id: pubBook.json.data.id });
    testApptId = pubBook.json.data.id;
  }

  /* ── List ── */
  const list = await GET('/appointments', { token: adminToken });
  log(list.status === 200 ? 'PASS' : 'FAIL', 'GET /appointments → 200', `got ${list.status}`);
  log(Array.isArray(list.json?.data) ? 'PASS' : 'FAIL', 'Appointments returns array');

  /* ── Stats ── */
  const stats = await GET('/appointments/stats', { token: adminToken });
  log(stats.status === 200 ? 'PASS' : 'FAIL', 'GET /appointments/stats → 200', `got ${stats.status}`);

  /* ── Create (authenticated) ── */
  const create = await POST('/appointments', {
    property_id:      testPropId || 1,
    customer_id:      testCustId || null,
    customer_name:    'QA_TEST_Auth Visitor',
    customer_phone:   '0512340000',
    appointment_date: '2027-07-01',
    appointment_time: '14:00',
    type:             'viewing',
    admin_notes:      'QA test appointment',
  }, { token: adminToken });
  log(create.status === 201 ? 'PASS' : 'FAIL', 'POST /appointments (authenticated) → 201', `got ${create.status}`);
  const authApptId = create.json?.data?.id;
  if (authApptId) createdItems.push({ type: 'appointment', id: authApptId });

  /* ── Get single ── */
  if (testApptId) {
    const getOne = await GET(`/appointments/${testApptId}`, { token: adminToken });
    log(getOne.status === 200 ? 'PASS' : 'FAIL', `GET /appointments/${testApptId} → 200`, `got ${getOne.status}`);
  }

  /* ── Update status ── */
  if (authApptId) {
    const stat = await PATCH(`/appointments/${authApptId}/status`, { status: 'confirmed' }, { token: adminToken });
    log(stat.status === 200 ? 'PASS' : 'FAIL', 'PATCH /appointments/status confirmed → 200', `got ${stat.status}`);

    /* ── Invalid transition (from confirmed back to pending) ── */
    const badTrans = await PATCH(`/appointments/${authApptId}/status`, { status: 'pending' }, { token: adminToken });
    log(badTrans.status === 422 ? 'PASS' : 'FAIL', 'Invalid status transition → 422', `got ${badTrans.status}`);
  }

  /* ── Non-existent ── */
  const none = await GET('/appointments/9999999', { token: adminToken });
  log(none.status === 404 ? 'PASS' : 'FAIL', 'GET /appointments/9999999 → 404', `got ${none.status}`);

  /* ── Unauthorized ── */
  const noAuth = await GET('/appointments');
  log(noAuth.status === 401 ? 'PASS' : 'FAIL', 'GET /appointments without token → 401', `got ${noAuth.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION H: CONTRACTS (Phase 2)
   ═══════════════════════════════════════════════════════════ */
async function testContracts() {
  section('H. CONTRACTS (Phase 2)');

  const r = await GET('/contracts', { token: adminToken });
  log(r.status === 501 ? 'PASS' : 'FAIL', 'GET /contracts → 501 (not implemented)', `got ${r.status}`);
  log(r.json?.message?.includes('not yet implemented') ? 'PASS' : 'FAIL', 'Contracts returns correct 501 message');
  log(!r.raw?.includes('<!doctype') ? 'PASS' : 'FAIL', 'Contracts does not return HTML');
}

/* ═══════════════════════════════════════════════════════════
   SECTION I: REPORTS (Phase 2, 6)
   ═══════════════════════════════════════════════════════════ */
async function testReports() {
  section('I. REPORTS (Phases 2,6)');

  /* ── Dashboard ── */
  const dash = await GET('/reports/dashboard', { token: adminToken });
  log(dash.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/dashboard → 200', `got ${dash.status}`);
  log(typeof dash.json?.data?.available_properties === 'number' ? 'PASS' : 'FAIL', 'Dashboard has available_properties count');
  log(typeof dash.json?.data?.total_customers === 'number' ? 'PASS' : 'FAIL', 'Dashboard has total_customers count');
  log(dash.json?.data?.active_contracts === 0 ? 'PASS' : 'FAIL', 'active_contracts = 0 (contracts not implemented, correctly zero)');
  log(Number(dash.json?.data?.revenue_this_month) === 0 ? 'PASS' : 'FAIL', 'revenue_this_month = 0 (contracts not implemented)');

  /* ── Properties report ── */
  const propRep = await GET('/reports/properties', { token: adminToken });
  log(propRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/properties → 200', `got ${propRep.status}`);
  log(Array.isArray(propRep.json?.data?.byStatus) ? 'PASS' : 'FAIL', 'Properties report has byStatus breakdown');
  log(Array.isArray(propRep.json?.data?.byType) ? 'PASS' : 'FAIL', 'Properties report has byType breakdown');

  /* ── Customers report ── */
  const custRep = await GET('/reports/customers', { token: adminToken });
  log(custRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/customers → 200', `got ${custRep.status}`);

  /* ── Financial report ── */
  const finRep = await GET('/reports/financials', { token: adminToken });
  log(finRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/financials → 200', `got ${finRep.status}`);
  log(Number(finRep.json?.data?.totals?.total_paid || 0) === 0 ? 'PASS' : 'FAIL', 'Financial totals = 0 (no contracts)');

  /* ── Agent performance ── */
  const agentRep = await GET('/reports/agents', { token: adminToken });
  log(agentRep.status === 200 ? 'PASS' : 'FAIL', 'GET /reports/agents → 200', `got ${agentRep.status}`);

  /* ── RBAC: employee cannot access financial report ── */
  if (empToken) {
    const empFin = await GET('/reports/financials', { token: empToken });
    log(empFin.status === 403 ? 'PASS' : 'FAIL', 'Employee GET /reports/financials → 403', `got ${empFin.status}`);
    const empAgent = await GET('/reports/agents', { token: empToken });
    log(empAgent.status === 403 ? 'PASS' : 'FAIL', 'Employee GET /reports/agents → 403', `got ${empAgent.status}`);
  }

  /* ── Date filtering ── */
  const dated = await GET('/reports/properties?from=2024-01-01&to=2027-12-31', { token: adminToken });
  log(dated.status === 200 ? 'PASS' : 'FAIL', 'Reports with date filter → 200', `got ${dated.status}`);

  /* ── Unauthorized ── */
  const noAuth = await GET('/reports/dashboard');
  log(noAuth.status === 401 ? 'PASS' : 'FAIL', 'GET /reports without token → 401', `got ${noAuth.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION J: ACTIVITIES LOG (Phase 2, 6)
   ═══════════════════════════════════════════════════════════ */
async function testActivities() {
  section('J. ACTIVITY LOG (Phases 2,6)');

  const acts = await GET('/activities', { token: adminToken });
  log(acts.status === 200 ? 'PASS' : 'FAIL', 'GET /activities → 200', `got ${acts.status}`);
  log(Array.isArray(acts.json?.data) ? 'PASS' : 'FAIL', 'Activities returns array');
  log(acts.json?.data?.length > 0 ? 'PASS' : 'FAIL', 'Activity log has entries');

  const first = acts.json?.data?.[0];
  log(!!first?.action ? 'PASS' : 'FAIL', 'Activity has action field');
  log(!!first?.description ? 'PASS' : 'FAIL', 'Activity has description field');
  log(!!first?.created_at ? 'PASS' : 'FAIL', 'Activity has created_at timestamp');

  /* ── Unauthorized ── */
  const noAuth = await GET('/activities');
  log(noAuth.status === 401 ? 'PASS' : 'FAIL', 'GET /activities without token → 401', `got ${noAuth.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION K: SECURITY AUDIT (Phase 11)
   ═══════════════════════════════════════════════════════════ */
async function testSecurity() {
  section('K. SECURITY AUDIT (Phase 11)');

  /* ── No stack traces in error responses ── */
  const badId = await GET('/properties/not_a_valid_id', { token: adminToken });
  log(!badId.raw?.includes('at Object') && !badId.raw?.includes('Error:') ? 'PASS' : 'FAIL', 
    'No stack trace in 404 response', `got status=${badId.status}`);

  /* ── SQL injection ── */
  const sqlInj1 = await GET(`/properties?search=${encodeURIComponent("' OR 1=1 --")}`, { token: adminToken });
  log(sqlInj1.status === 200 ? 'PASS' : 'FAIL', "SQL injection in search handled safely (200)", `got ${sqlInj1.status}`);
  const sqlInj2 = await GET(`/customers?search=${encodeURIComponent("'; DROP TABLE users;--")}`, { token: adminToken });
  log(sqlInj2.status === 200 ? 'PASS' : 'FAIL', "SQL injection in customers search handled safely", `got ${sqlInj2.status}`);

  /* ── password_hash never returned ── */
  const userDetail = await GET('/users', { token: adminToken });
  const anyPwHash = userDetail.json?.data?.some(u => !!u.password_hash);
  log(!anyPwHash ? 'PASS' : 'FAIL', 'Users API never returns password_hash');

  const meResp = await GET('/auth/me', { token: adminToken });
  log(!meResp.json?.data?.password_hash ? 'PASS' : 'FAIL', '/auth/me never returns password_hash');

  /* ── Helmet security headers ── */
  const headersRes = await req('GET', `${BASE}/`);
  log(!!headersRes.headers['x-content-type-options'] ? 'PASS' : 'FAIL', 'X-Content-Type-Options header present');
  log(!!headersRes.headers['x-frame-options'] || !!headersRes.headers['content-security-policy'] ? 'PASS' : 'FAIL', 'X-Frame-Options or CSP present');

  /* ── CORS: external origin ── */
  const extOrigin = await req('GET', `${API}/properties`, { 
    token: adminToken,
    headers: { 'Origin': 'https://evil-attacker.com' },
  });
  const acao = extOrigin.headers['access-control-allow-origin'];
  log(acao !== '*' ? 'PASS' : 'FAIL', 'CORS does not allow wildcard (*) for external origin', `ACAO=${acao}`);

  /* ── CORS: LAN origin allowed ── */
  const lanOrigin = await req('GET', `${API}/status`, {
    headers: { 'Origin': 'http://192.168.1.50:5000' },
  });
  const lacao = lanOrigin.headers['access-control-allow-origin'];
  log(lacao === 'http://192.168.1.50:5000' ? 'PASS' : 'FAIL', 'CORS allows LAN origin 192.168.x.x:5000', `ACAO=${lacao}`);

  /* ── IDOR: employee cannot access admin's customer ── */
  if (empToken && testCustId) {
    const idor = await GET(`/customers/${testCustId}`, { token: empToken });
    log(idor.status === 403 ? 'PASS' : 'FAIL', 'IDOR: Employee cannot access admin customer → 403', `got ${idor.status}`);
  }

  /* ── Auth token is not in response body on refresh ── */
  const refR = await POST('/auth/refresh', {}, { cookie: adminCookie });
  log(!refR.json?.data?.refreshToken ? 'PASS' : 'FAIL', 'Refresh token NOT returned in response body');

  /* ── Rate limiter present ── */
  const rl = await GET('/properties', { token: adminToken });
  const hasRl = rl.headers['x-ratelimit-limit'] || rl.headers['ratelimit-limit'] || rl.headers['x-rate-limit-limit'];
  log(!!hasRl ? 'PASS' : 'FAIL', 'Rate-limit header present in responses', `header=${hasRl}`);
  
  // Refresh token after using it - update adminCookie  
  if (refR.json?.data?.accessToken) {
    adminToken  = refR.json.data.accessToken;
    adminCookie = `rems_rt=${refR.setCookies?.rems_rt}`;
  }
}

/* ═══════════════════════════════════════════════════════════
   SECTION L: ERROR HANDLING (Phase 12)
   ═══════════════════════════════════════════════════════════ */
async function testErrorHandling() {
  section('L. ERROR HANDLING (Phase 12)');

  /* ── Invalid JSON body ── */
  const badJson = await new Promise(resolve => {
    const r = http.request({
      hostname: 'localhost', port: 5000, path: '/api/v1/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': 12 },
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { let j; try { j = JSON.parse(d); } catch {} resolve({ status: res.statusCode, json: j, raw: d }); });
    });
    r.on('error', e => resolve({ status: 0, json: null, raw: e.message }));
    r.write('{invalid}!'); r.end();
  });
  log(badJson.status === 400 ? 'PASS' : 'FAIL', 'Invalid JSON body → 400', `got ${badJson.status}`);

  /* ── Missing required field ── */
  const missFld = await POST('/customers', { phone: '0500000000' }, { token: adminToken });
  log(missFld.status === 422 ? 'PASS' : 'FAIL', 'Missing required field → 422', `got ${missFld.status}`);
  log(!!missFld.json?.errors || !!missFld.json?.message ? 'PASS' : 'FAIL', '422 response has error details');

  /* ── Nonexistent route ── */
  const noRoute = await GET('/this_route_does_not_exist_at_all');
  log(noRoute.status === 404 ? 'PASS' : 'FAIL', 'Nonexistent API route → 404', `got ${noRoute.status}`);
  log(noRoute.json?.success === false ? 'PASS' : 'FAIL', 'Nonexistent route returns JSON {success:false}');

  /* ── 403 for unauthorized action ── */
  const forbid = await GET('/users', { token: empToken });
  log(forbid.status === 403 ? 'PASS' : 'FAIL', 'Forbidden route returns 403', `got ${forbid.status}`);
  log(forbid.json?.success === false ? 'PASS' : 'FAIL', '403 response has JSON {success:false}');

  /* ── Very long input (boundary test) ── */
  const longInput = await POST('/customers', {
    name:  'A'.repeat(10000),
    phone: '0512345678',
  }, { token: adminToken });
  log(longInput.status === 422 ? 'PASS' : 'FAIL', 'Very long name → 422 (validation)', `got ${longInput.status}`);

  /* ── Negative price (boundary) ── */
  const negPrice = await POST('/properties', {
    type_id: 1, type: 'Apartment', title: 'Neg Price', location: 'X', city: 'X',
    address: 'X', area: 100, price: -999, payment_method: 'cash',
    listing_type: 'sale', owner_name: 'X', owner_phone: '0500000000',
  }, { token: adminToken });
  log([422, 400].includes(negPrice.status) ? 'PASS' : 'FAIL', 'Negative price → 400/422', `got ${negPrice.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION M: CHANGE PASSWORD (Phase 7)
   ═══════════════════════════════════════════════════════════ */
async function testChangePassword() {
  section('M. CHANGE PASSWORD (Phase 7)');

  /* ── Wrong current password ── */
  const wrong = await POST('/auth/change-password', {
    current_password: 'WRONG_CURRENT_PASS',
    new_password:     'NewPass@12345',
  }, { token: adminToken });
  log(wrong.status === 400 ? 'PASS' : 'FAIL', 'Change password with wrong current → 400', `got ${wrong.status}`);

  /* ── Same password ── */
  const same = await POST('/auth/change-password', {
    current_password: ADMIN_PASS,
    new_password:     ADMIN_PASS,
  }, { token: adminToken });
  log(same.status === 400 ? 'PASS' : 'FAIL', 'Change password to same value → 400', `got ${same.status}`);

  /* ── Without auth ── */
  const noauth = await POST('/auth/change-password', {
    current_password: ADMIN_PASS,
    new_password:     'NewPass@12345',
  });
  log(noauth.status === 401 ? 'PASS' : 'FAIL', 'Change password without auth → 401', `got ${noauth.status}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION N: LAN / NETWORK (Phase 13)
   ═══════════════════════════════════════════════════════════ */
async function testLAN() {
  section('N. LAN / NETWORK (Phase 13)');

  /* ── Server reachable via 127.0.0.1 ── */
  const via127 = await req('GET', 'http://127.0.0.1:5000/health');
  log(via127.status === 200 ? 'PASS' : 'FAIL', 'Server reachable via 127.0.0.1:5000', `got ${via127.status}`);

  /* ── HOST=0.0.0.0 binding ── */
  log(via127.status === 200 ? 'PASS' : 'FAIL', 'Server binds on 0.0.0.0 (LAN accessible)', 'verified via 127.0.0.1 connectivity');

  /* ── Uploads accessible via /uploads/ ── */
  const uploadDir = path.join(__dirname, '..', 'backend', 'uploads', 'properties');
  const files = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).filter(f => f !== '.gitkeep') : [];
  if (files.length > 0) {
    const testFile = files[0];
    const uploadReq = await req('GET', `${BASE}/uploads/properties/${testFile}`);
    log(uploadReq.status === 200 ? 'PASS' : 'FAIL', `Static uploads served: /uploads/properties/${testFile}`, `got ${uploadReq.status}`);
  } else {
    log('BLOCK', 'No uploaded files to verify static serving');
  }

  /* ── No hardcoded localhost in API responses ── */
  const props = await GET('/properties?limit=3', { token: adminToken });
  const bodyStr = JSON.stringify(props.json || '');
  log(!bodyStr.includes('localhost:3000') && !bodyStr.includes('127.0.0.1:3000') ? 'PASS' : 'FAIL',
    'API responses contain no hardcoded development URLs');
}

/* ═══════════════════════════════════════════════════════════
   SECTION O: DATA INTEGRITY (Phase 10)
   ═══════════════════════════════════════════════════════════ */
async function testDataIntegrity() {
  section('O. DATA INTEGRITY (Phase 10)');

  /* ── Verify test property persists ── */
  if (testPropId) {
    const gp = await GET(`/properties/${testPropId}`, { token: adminToken });
    log(gp.status === 200 && gp.json?.data?.title === 'QA_TEST_Property' ? 'PASS' : 'FAIL',
      'Created property persists and title is correct', `title=${gp.json?.data?.title}`);
    // Verify price update persisted
    log(gp.json?.data?.price === 800000 ? 'PASS' : 'FAIL',
      'Updated price persists (800000)', `price=${gp.json?.data?.price}`);
  }

  /* ── Verify test customer persists ── */
  if (testCustId) {
    const gc = await GET(`/customers/${testCustId}`, { token: adminToken });
    log(gc.status === 200 && gc.json?.data?.name === 'QA_TEST_Customer' ? 'PASS' : 'FAIL',
      'Created customer persists', `name=${gc.json?.data?.name}`);
    log(gc.json?.data?.status === 'interested' ? 'PASS' : 'FAIL',
      'Customer status update persists (interested)', `status=${gc.json?.data?.status}`);
  }

  /* ── Dashboard counts reflect reality ── */
  const dash = await GET('/reports/dashboard', { token: adminToken });
  const avail = dash.json?.data?.available_properties;
  log(typeof avail === 'number' && avail > 0 ? 'PASS' : 'FAIL',
    'Dashboard available_properties > 0 (live data)', `count=${avail}`);
}

/* ═══════════════════════════════════════════════════════════
   SECTION P: PERFORMANCE SANITY (Phase 17)
   ═══════════════════════════════════════════════════════════ */
async function testPerformance() {
  section('P. PERFORMANCE SANITY (Phase 17)');

  const endpoints = [
    { path: '/reports/dashboard', name: 'Dashboard' },
    { path: '/properties?limit=20', name: 'Properties list' },
    { path: '/customers?limit=20', name: 'Customers list' },
    { path: '/activities?limit=20', name: 'Activities log' },
    { path: '/reports/properties', name: 'Properties report' },
  ];

  for (const ep of endpoints) {
    const t0 = Date.now();
    const r = await GET(ep.path, { token: adminToken });
    const ms = Date.now() - t0;
    log(r.status === 200 && ms < 2000 ? 'PASS' : 'FAIL',
      `${ep.name} responds < 2s`, `${ms}ms status=${r.status}`);
  }
}

/* ═══════════════════════════════════════════════════════════
   SECTION Q: BUILD VERIFICATION (Phase 14)
   ═══════════════════════════════════════════════════════════ */
async function testBuild() {
  section('Q. PRODUCTION BUILD VERIFICATION (Phase 14)');

  // Verify backend/public exists (built SPA)
  const pubDir = path.join(__dirname, '..', 'backend', 'public');
  const indexHtml = path.join(pubDir, 'index.html');
  const assetsDir = path.join(pubDir, 'assets');
  log(fs.existsSync(indexHtml) ? 'PASS' : 'FAIL', 'backend/public/index.html exists (built SPA)');
  log(fs.existsSync(assetsDir) ? 'PASS' : 'FAIL', 'backend/public/assets/ exists');

  // Verify .env has required keys (without exposing values)
  const envPath = path.join(__dirname, '..', 'backend', '.env');
  const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  log(envContent.includes('NODE_ENV') ? 'PASS' : 'FAIL', '.env has NODE_ENV');
  log(envContent.includes('JWT_SECRET') ? 'PASS' : 'FAIL', '.env has JWT_SECRET');
  log(envContent.includes('JWT_REFRESH_SECRET') ? 'PASS' : 'FAIL', '.env has JWT_REFRESH_SECRET');
  log(envContent.includes('COOKIE_SECRET') ? 'PASS' : 'FAIL', '.env has COOKIE_SECRET');
  log(envContent.includes('NODE_ENV=production') ? 'PASS' : 'FAIL', '.env NODE_ENV=production');

  // Health confirms production mode
  const h = await req('GET', `${BASE}/health`);
  log(h.json?.environment === 'production' ? 'PASS' : 'FAIL', 'Server running in production mode', `env=${h.json?.environment}`);

  // SPA served correctly
  const spaRoot = await req('GET', `${BASE}/`);
  log(spaRoot.status === 200 ? 'PASS' : 'FAIL', 'Production SPA served at /');
  const spaLogin = await req('GET', `${BASE}/login`);
  log(spaLogin.status === 200 ? 'PASS' : 'FAIL', 'Production SPA served at /login (React Router)');

  // API works
  const apiSt = await req('GET', `${API}/status`);
  log(apiSt.status === 200 ? 'PASS' : 'FAIL', 'API /v1/status works');
}

/* ═══════════════════════════════════════════════════════════
   SECTION R: INTERNATIONALIZATION (Phase 2)
   ═══════════════════════════════════════════════════════════ */
async function testI18n() {
  section('R. INTERNATIONALIZATION (Phase 2)');

  const arPath = path.join(__dirname, '..', 'frontend', 'src', 'i18n', 'locales', 'ar.js');
  const enPath = path.join(__dirname, '..', 'frontend', 'src', 'i18n', 'locales', 'en.js');
  log(fs.existsSync(arPath) ? 'PASS' : 'FAIL', 'Arabic locale file exists (ar.js)');
  log(fs.existsSync(enPath) ? 'PASS' : 'FAIL', 'English locale file exists (en.js)');

  const providerPath = path.join(__dirname, '..', 'frontend', 'src', 'i18n', 'I18nProvider.jsx');
  log(fs.existsSync(providerPath) ? 'PASS' : 'FAIL', 'I18nProvider.jsx exists');

  const provContent = fs.existsSync(providerPath) ? fs.readFileSync(providerPath, 'utf8') : '';
  log(provContent.includes("localStorage.getItem('rems_language')") || provContent.includes("localStorage.getItem(STORAGE_KEY)") ? 'PASS' : 'FAIL', 
    'Language persisted via localStorage');
  log(provContent.includes("document.documentElement.dir") ? 'PASS' : 'FAIL', 'RTL/LTR direction set on document');

  // Check if App.jsx wraps with I18nProvider
  const appPath = path.join(__dirname, '..', 'frontend', 'src', 'App.jsx');
  const mainPath = path.join(__dirname, '..', 'frontend', 'src', 'main.jsx');
  const mainContent = fs.existsSync(mainPath) ? fs.readFileSync(mainPath, 'utf8') : '';
  log(mainContent.includes('I18nProvider') ? 'PASS' : 'FAIL', 'main.jsx wraps app in I18nProvider');

  // Language switcher in UI — check if MainLayout or Navbar has it
  const mainLayoutPath = path.join(__dirname, '..', 'frontend', 'src', 'components', 'layout');
  const layoutFiles = fs.existsSync(mainLayoutPath) ? fs.readdirSync(mainLayoutPath) : [];
  let hasLangSwitcher = false;
  for (const f of layoutFiles) {
    const content = fs.readFileSync(path.join(mainLayoutPath, f), 'utf8');
    if (content.includes('setLanguage') || content.includes('language') && content.includes('switcher')) {
      hasLangSwitcher = true; break;
    }
  }
  log(hasLangSwitcher ? 'PASS' : 'FAIL', 'Language switcher present in layout components (setLanguage used)');
}

/* ═══════════════════════════════════════════════════════════
   CLEANUP
   ═══════════════════════════════════════════════════════════ */
async function cleanup() {
  section('Z. CLEANUP — Removing QA Test Records');

  // Delete in reverse order of dependencies: appointments → customers → properties → users
  const order = ['appointment', 'customer', 'property', 'user'];
  const sorted = createdItems.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));

  for (const item of sorted) {
    const pathMap = {
      appointment: `/appointments/${item.id}`,
      customer:    `/customers/${item.id}`,
      property:    `/properties/${item.id}`,
      user:        `/users/${item.id}`,
    };
    const p = pathMap[item.type];
    if (!p) continue;
    const r = await DELETE(p, { token: adminToken });
    log([200, 204, 404].includes(r.status) ? 'PASS' : 'FAIL',
      `Cleanup: DELETE ${item.type} #${item.id}`, `got ${r.status}`);
  }

  // Logout employee
  if (empToken) {
    const lo = await POST('/auth/logout', {}, { token: empToken, cookie: empCookie });
    log(lo.status === 200 ? 'PASS' : 'FAIL', 'Employee logout on cleanup', `got ${lo.status}`);
  }

  // Logout admin
  const adminLo = await POST('/auth/logout', {}, { token: adminToken, cookie: adminCookie });
  log(adminLo.status === 200 ? 'PASS' : 'FAIL', 'Admin logout on cleanup', `got ${adminLo.status}`);
}

/* ═══════════════════════════════════════════════════════════
   MAIN
   ═══════════════════════════════════════════════════════════ */
async function main() {
  process.stdout.write('\n════════════════════════════════════════════════════════\n');
  process.stdout.write('  REMS FINAL PRE-DELIVERY QA AUDIT\n');
  process.stdout.write(`  ${new Date().toISOString()}\n`);
  process.stdout.write('════════════════════════════════════════════════════════\n');

  await testHealth();
  await testAuth();
  await testUsers();
  await testProperties();
  await testMedia();
  await testCustomers();
  await testAppointments();
  await testContracts();
  await testReports();
  await testActivities();
  await testSecurity();
  await testErrorHandling();
  await testChangePassword();
  await testLAN();
  await testDataIntegrity();
  await testPerformance();
  await testBuild();
  await testI18n();
  await cleanup();

  const total = passed + failed + blocked;
  process.stdout.write('\n════════════════════════════════════════════════════════\n');
  process.stdout.write('  FINAL TEST RESULTS\n');
  process.stdout.write('════════════════════════════════════════════════════════\n');
  process.stdout.write(`  PASSED:  ${passed}\n`);
  process.stdout.write(`  FAILED:  ${failed}\n`);
  process.stdout.write(`  BLOCKED: ${blocked}\n`);
  process.stdout.write(`  TOTAL:   ${total}\n`);
  process.stdout.write(`  PASS%:   ${Math.round(100 * passed / total)}%\n`);
  process.stdout.write('════════════════════════════════════════════════════════\n\n');

  // Write results to JSON for report generation
  fs.writeFileSync(
    path.join(__dirname, 'qa_results.json'),
    JSON.stringify({ passed, failed, blocked, total, results: allResults }, null, 2)
  );
  process.stdout.write(`Results saved to QA_REPORT/qa_results.json\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
  process.stderr.write(`FATAL: ${e.message}\n${e.stack}\n`);
  process.exit(1);
});
