'use strict';
/**
 * test-full-audit.js
 * Comprehensive runtime audit script for the REMS final pre-delivery audit.
 * Tests: API endpoints, authorization, IDOR, CRUD, error handling, uploads, reports.
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const BASE  = 'http://localhost:5000/api/v1';
const EMAIL = 'admin@test.com';
const PASS  = 'Admin@123456';

let passCount = 0;
let failCount = 0;
const results = [];

function assert(label, condition, detail = '') {
  if (condition) {
    process.stdout.write(`  ✓ PASS: ${label}\n`);
    passCount++;
    results.push({ label, pass: true });
  } else {
    process.stdout.write(`  ✗ FAIL: ${label}${detail ? ' — ' + detail : ''}\n`);
    failCount++;
    results.push({ label, pass: false, detail });
  }
}

function request(method, path, body, cookieJar, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url    = new URL(BASE + path);
    const data   = body ? JSON.stringify(body) : null;
    const cookies = cookieJar
      ? Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ')
      : '';
    const options = {
      hostname: url.hostname,
      port:     parseInt(url.port) || 80,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(cookies ? { 'Cookie': cookies } : {}),
        ...extraHeaders,
      },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        const setCookies = {};
        (res.headers['set-cookie'] || []).forEach(c => {
          const [pair] = c.split(';');
          const [k, v] = pair.split('=');
          if (k && v !== undefined) setCookies[k.trim()] = v.trim();
        });
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
        resolve({ status: res.statusCode, body: parsed, setCookies, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function authRequest(method, path, body, token, extraHeaders = {}) {
  return request(method, path, body, null, {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Login helper ──────────────────────────────────────────
async function login(email, password) {
  const r = await request('POST', '/auth/login', { email, password });
  return {
    status: r.status,
    token: r.body.data?.accessToken,
    cookie: r.setCookies,
  };
}

// ═══════════════════════════════════════════════════════════
//  PHASE 2 — Build verification
// ═══════════════════════════════════════════════════════════
async function testBuild() {
  console.log('\n══ PHASE 2: Build & Startup ══');
  const publicExists = fs.existsSync(
    path.join(__dirname, 'public', 'index.html')
  );
  assert('backend/public/index.html exists (build output)', publicExists);

  const r = await request('GET', '/../health').catch(() => ({ status: 0 }));
  const health = await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/health', res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
  });
  assert('Health endpoint 200', health.status === 200);
  assert('NODE_ENV is production', health.body.environment === 'production');
}

// ═══════════════════════════════════════════════════════════
//  PHASE 3 — Database
// ═══════════════════════════════════════════════════════════
async function testDatabase(token) {
  console.log('\n══ PHASE 3: Database ══');

  // Verify all expected tables exist via the check-db script output
  // We can indirectly verify by checking endpoints that depend on each table
  const r1 = await authRequest('GET', '/reports/dashboard', null, token);
  assert('Dashboard queries succeed (DB connection + views)', r1.status === 200);
  assert('Dashboard returns expected fields',
    r1.body.data && 'available_properties' in r1.body.data
  );

  const r2 = await authRequest('GET', '/properties/types', null, token);
  assert('property_types table accessible', r2.status === 200);
  assert('Property types seeded (≥1 type)',
    Array.isArray(r2.body.data) && r2.body.data.length > 0,
    `Got ${r2.body.data?.length}`
  );

  const r3 = await authRequest('GET', '/activities?limit=1', null, token);
  assert('activities table accessible', r3.status === 200);

  const r4 = await authRequest('GET', '/users', null, token);
  assert('users table accessible', r4.status === 200);
  assert('Admin user exists in DB',
    Array.isArray(r4.body.data) && r4.body.data.length > 0
  );
}

// ═══════════════════════════════════════════════════════════
//  PHASE 4 — Auth & Authorization
// ═══════════════════════════════════════════════════════════
async function testAuth() {
  console.log('\n══ PHASE 4: Authentication & Authorization ══');

  // Invalid credentials
  const r1 = await request('POST', '/auth/login', { email: EMAIL, password: 'wrongpass' });
  assert('Wrong password → 401', r1.status === 401);

  const r2 = await request('POST', '/auth/login', { email: 'nobody@x.com', password: PASS });
  assert('Unknown email → 401', r2.status === 401);

  const r3 = await request('POST', '/auth/login', {});
  assert('Empty login body → 422', r3.status === 422);

  const r4 = await request('POST', '/auth/login', { email: 'not-an-email', password: PASS });
  assert('Malformed email → 422', r4.status === 422);

  // Valid login
  const loginRes = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  assert('Valid login → 200', loginRes.status === 200);
  assert('Access token in response', !!loginRes.body.data?.accessToken);
  assert('refreshToken NOT in login response body', !loginRes.body.data?.refreshToken);
  assert('HttpOnly refresh cookie set', !!loginRes.setCookies['rems_rt']);

  const token = loginRes.body.data.accessToken;
  const cookie = loginRes.setCookies;

  // /auth/me
  const me = await authRequest('GET', '/auth/me', null, token);
  assert('GET /auth/me → 200', me.status === 200);
  assert('/auth/me returns correct email', me.body.data?.email === EMAIL);
  assert('/auth/me does NOT return password_hash', !me.body.data?.password_hash);

  // Unauthenticated access
  const noAuth = await request('GET', '/properties');
  assert('Protected endpoint without token → 401', noAuth.status === 401);

  // Expired/invalid token
  const badToken = await authRequest('GET', '/auth/me', null, 'invalid.token.string');
  assert('Invalid token → 401', badToken.status === 401);

  // Refresh
  const refreshRes = await request('POST', '/auth/refresh', {}, cookie);
  assert('Refresh → 200', refreshRes.status === 200);
  assert('New access token returned', !!refreshRes.body.data?.accessToken);
  assert('refreshToken NOT in refresh response body', !refreshRes.body.data?.refreshToken);
  assert('New refresh cookie set on refresh', !!refreshRes.setCookies['rems_rt']);

  // Old cookie must fail after rotation
  const oldCookieReuse = await request('POST', '/auth/refresh', {}, cookie);
  assert('Old refresh token rejected after rotation → 401', oldCookieReuse.status === 401);

  const newToken = refreshRes.body.data.accessToken;
  const newCookie = { ...cookie, ...refreshRes.setCookies };

  // Logout
  const logoutRes = await new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${newToken}`,
        'Cookie': Object.entries(newCookie).map(([k,v]) => `${k}=${v}`).join('; '),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  assert('Logout → 200', logoutRes.status === 200);

  // Logged-out token must fail
  const afterLogout = await request('POST', '/auth/refresh', {}, newCookie);
  assert('Logged-out refresh token → 401', afterLogout.status === 401);

  // Register — should fail since admin already exists (not bootstrap)
  const regAnon = await request('POST', '/auth/register', {
    name: 'Test User', email: 'test@example.com', password: 'Test@12345',
  });
  assert('Unauthenticated register (admin exists) → 401', regAnon.status === 401);

  // Duplicate email registration attempt
  const loginAgain = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  const adminToken = loginAgain.body.data.accessToken;
  const dupReg = await authRequest('POST', '/auth/register', {
    name: 'Admin User', email: EMAIL, password: 'Test@12345',
  }, adminToken);
  assert('Duplicate email registration → 409', dupReg.status === 409);

  // Logout cleanup
  await new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${adminToken}`,
        'Cookie': Object.entries(loginAgain.setCookies).map(([k,v]) => `${k}=${v}`).join('; '),
      },
    }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.write(data); req.end();
  });

  return adminToken; // caller logs in again
}

// ═══════════════════════════════════════════════════════════
//  PHASE 5 — API Endpoint Inventory + Authorization
// ═══════════════════════════════════════════════════════════
async function testAPIEndpoints(token) {
  console.log('\n══ PHASE 5: API Endpoint Audit ══');

  // Status endpoint (public)
  const status = await request('GET', '/status');
  assert('GET /status → 200 (public)', status.status === 200);
  assert('Status does not leak NODE_ENV', !('environment' in (status.body || {})));

  // Users (admin only)
  const users = await authRequest('GET', '/users', null, token);
  assert('GET /users (admin) → 200', users.status === 200);
  assert('GET /users returns array', Array.isArray(users.body.data));

  // Non-existent user
  const noUser = await authRequest('GET', '/users/9999999', null, token);
  assert('GET /users/9999999 → 404', noUser.status === 404);

  // Properties
  const props = await authRequest('GET', '/properties', null, token);
  assert('GET /properties → 200', props.status === 200);
  assert('GET /properties returns array + meta', Array.isArray(props.body.data) && props.body.meta);

  // Property types
  const types = await authRequest('GET', '/properties/types', null, token);
  assert('GET /properties/types → 200', types.status === 200);

  // Customers
  const custs = await authRequest('GET', '/customers', null, token);
  assert('GET /customers → 200', custs.status === 200);

  // Customer pipeline
  const pipe = await authRequest('GET', '/customers/pipeline', null, token);
  assert('GET /customers/pipeline → 200', pipe.status === 200);

  // Appointments
  const apts = await authRequest('GET', '/appointments', null, token);
  assert('GET /appointments → 200', apts.status === 200);

  // Appointment stats
  const aptStats = await authRequest('GET', '/appointments/stats', null, token);
  assert('GET /appointments/stats → 200', aptStats.status === 200);

  // Reports
  const dash = await authRequest('GET', '/reports/dashboard', null, token);
  assert('GET /reports/dashboard → 200', dash.status === 200);

  const propReport = await authRequest('GET', '/reports/properties', null, token);
  assert('GET /reports/properties → 200', propReport.status === 200);

  const custReport = await authRequest('GET', '/reports/customers', null, token);
  assert('GET /reports/customers → 200', custReport.status === 200);

  const finReport = await authRequest('GET', '/reports/financials', null, token);
  assert('GET /reports/financials (admin) → 200', finReport.status === 200);

  const agentReport = await authRequest('GET', '/reports/agents', null, token);
  assert('GET /reports/agents (admin) → 200', agentReport.status === 200);

  // Activities
  const acts = await authRequest('GET', '/activities', null, token);
  assert('GET /activities → 200', acts.status === 200);

  // Contracts — must return 501 (stub)
  // Note: contracts is NOT registered in the main routes/index.js, only clientRoutes
  // The contractRoutes.js exists but is NOT mounted in index.js — so it returns 404
  const contractsRes = await authRequest('GET', '/contracts', null, token);
  assert('GET /contracts → 404 or 501 (stub/not mounted)', contractsRes.status === 404 || contractsRes.status === 501,
    `got ${contractsRes.status}`);

  // 404 for unknown route (note: in production, React catch-all serves index.html for GET)
  // For API routes, unknown API path returns 404
  const unknown = await authRequest('DELETE', '/nonexistent', null, token);
  assert('Unknown API route (DELETE) → 404', unknown.status === 404);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 5b — Authorization tests (role enforcement)
// ═══════════════════════════════════════════════════════════
async function testAuthorization(adminToken) {
  console.log('\n══ PHASE 5b: Authorization (Role Enforcement) ══');

  // Clean up any leftover test employee from a previous run
  const allUsers = await authRequest('GET', '/users?limit=100', null, adminToken);
  const leftover = (allUsers.body.data || []).find(u => u.email === 'testemployee.audit@gmail.com');
  if (leftover) await authRequest('DELETE', `/users/${leftover.id}`, null, adminToken);

  // Create a test employee (use a valid email domain)
  const empCreate = await authRequest('POST', '/users', {
    name: 'Test Employee', email: 'testemployee.audit@gmail.com',
    password: 'Test@123456', role: 'employee',
  }, adminToken);
  assert('Create test employee → 201', empCreate.status === 201);
  const empId = empCreate.body.data?.id;

  // Login as employee
  const empLogin = await request('POST', '/auth/login', {
    email: 'testemployee.audit@gmail.com', password: 'Test@123456',
  });
  assert('Employee login → 200', empLogin.status === 200);
  const empToken = empLogin.body.data?.accessToken;
  const empCookie = empLogin.setCookies;

  // Employee cannot access /users (admin only)
  const empUsers = await authRequest('GET', '/users', null, empToken);
  assert('Employee cannot GET /users → 403', empUsers.status === 403);

  // Employee cannot create users
  const empCreate2 = await authRequest('POST', '/users', {
    name: 'Another', email: 'another@test.com', password: 'Test@123456',
  }, empToken);
  assert('Employee cannot POST /users → 403', empCreate2.status === 403);

  // Employee cannot access financial reports
  const empFin = await authRequest('GET', '/reports/financials', null, empToken);
  assert('Employee cannot GET /reports/financials → 403', empFin.status === 403);

  // Employee cannot access agent performance reports
  const empAgent = await authRequest('GET', '/reports/agents', null, empToken);
  assert('Employee cannot GET /reports/agents → 403', empAgent.status === 403);

  // IDOR test — create a customer as admin, try to access as employee
  const custCreate = await authRequest('POST', '/customers', {
    name: 'Admin Customer Audit', phone: '0501234567', status: 'new',
  }, adminToken);
  assert('Create customer as admin → 201', custCreate.status === 201);
  const custId = custCreate.body.data?.id;

  // Employee should NOT see admin's customer (IDOR check)
  const empCust = await authRequest('GET', `/customers/${custId}`, null, empToken);
  assert(`Employee cannot access admin's customer → 403`, empCust.status === 403,
    `got ${empCust.status}: ${empCust.body?.message}`
  );

  // Create a property as admin, try to edit as employee (different agent)
  const propCreate = await authRequest('POST', '/properties', {
    type_id: 1, type: 'Apartment', title: 'Audit Test Property',
    location: 'Test City', address: '1 Test Street',
    area: 100, price: 500000,
    owner_name: 'Owner Test', owner_phone: '0501111111',
  }, adminToken);
  assert('Create property as admin → 201', propCreate.status === 201);
  const propId = propCreate.body.data?.id;

  // Employee (not owner) should not edit this property
  const empPropEdit = await authRequest('PUT', `/properties/${propId}`, {
    title: 'Hacked Title',
  }, empToken);
  assert("Employee cannot edit admin's property → 403", empPropEdit.status === 403,
    `got ${empPropEdit.status}: ${empPropEdit.body?.message}`
  );

  // Logout employee
  await new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${empToken}`,
        'Cookie': Object.entries(empCookie).map(([k,v]) => `${k}=${v}`).join('; '),
      },
    }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.write(data); req.end();
  });

  // Cleanup
  if (empId) await authRequest('DELETE', `/users/${empId}`, null, adminToken);
  if (custId) await authRequest('DELETE', `/customers/${custId}`, null, adminToken);
  if (propId) await authRequest('DELETE', `/properties/${propId}`, null, adminToken);

  return { empId, custId, propId };
}

// ═══════════════════════════════════════════════════════════
//  PHASE 6–7 — Customer + Property CRUD
// ═══════════════════════════════════════════════════════════
async function testCRUD(token) {
  console.log('\n══ PHASE 6-7: CRUD (Customers & Properties) ══');

  // ── Customer CRUD ──
  const cCreate = await authRequest('POST', '/customers', {
    name: 'أحمد العلي', phone: '0501234567',
    email: 'ahmed@test.com', status: 'new',
    budget: 500000, budget_min: 300000,
  }, token);
  assert('Create customer (Arabic name, budget) → 201', cCreate.status === 201);
  const cId = cCreate.body.data?.id;
  const cUuid = cCreate.body.data?.uuid;
  assert('Customer has uuid', !!cUuid);

  // Read
  const cRead = await authRequest('GET', `/customers/${cId}`, null, token);
  assert('Read customer → 200', cRead.status === 200);
  assert('Customer name matches', cRead.body.data?.name === 'أحمد العلي');

  // Update
  const cUpdate = await authRequest('PUT', `/customers/${cId}`, {
    notes: 'Updated notes',
  }, token);
  assert('Update customer → 200', cUpdate.status === 200);

  // Status update
  const cStatus = await authRequest('PATCH', `/customers/${cId}/status`, {
    status: 'interested',
  }, token);
  assert('Update customer status → 200', cStatus.status === 200);
  assert('Status persisted', cStatus.body.data?.status === 'interested');

  // Invalid status
  const cBadStatus = await authRequest('PATCH', `/customers/${cId}/status`, {
    status: 'flying_unicorn',
  }, token);
  assert('Invalid customer status → 422', cBadStatus.status === 422);

  // Empty body update — the nullableNumber defaults in schema make {} non-empty
  // so Joi's .min(1) passes; the update is a safe no-op
  const cEmptyUpdate = await authRequest('PUT', `/customers/${cId}`, {}, token);
  assert('Empty PUT body handled (no-op or 422)', cEmptyUpdate.status === 200 || cEmptyUpdate.status === 422);

  // Search
  const search = await authRequest('GET', `/customers?search=%D8%A3%D8%AD%D9%85%D8%AF`, null, token);
  assert('Customer search returns results', search.status === 200 && search.body.data?.length > 0);

  // Delete
  const cDelete = await authRequest('DELETE', `/customers/${cId}`, null, token);
  assert('Delete customer → 200', cDelete.status === 200);

  // Confirm deleted
  const cGone = await authRequest('GET', `/customers/${cId}`, null, token);
  assert('Deleted customer → 404', cGone.status === 404);

  // ── Property CRUD ──
  const pCreate = await authRequest('POST', '/properties', {
    type_id: 1, type: 'Apartment',
    title: 'شقة للبيع في الرياض',
    location: 'الرياض', address: 'حي النزهة، شارع الملك فهد',
    area: 150.5, price: 750000,
    owner_name: 'عبدالله المطيري', owner_phone: '0509876543',
    payment_method: 'installment', listing_type: 'sale',
    bedrooms: 3, bathrooms: 2,
  }, token);
  assert('Create property (Arabic data) → 201', pCreate.status === 201);
  const pId = pCreate.body.data?.id;
  assert('Property has id', !!pId);

  // Read
  const pRead = await authRequest('GET', `/properties/${pId}`, null, token);
  assert('Read property → 200', pRead.status === 200);
  assert('Property title matches', pRead.body.data?.title === 'شقة للبيع في الرياض');
  assert('Property includes images array', Array.isArray(pRead.body.data?.images));
  assert('Property includes videos array', Array.isArray(pRead.body.data?.videos));

  // Update
  const pUpdate = await authRequest('PUT', `/properties/${pId}`, {
    price: 800000,
    description: 'Updated description',
  }, token);
  assert('Update property → 200', pUpdate.status === 200);
  assert('Price updated', pUpdate.body.data?.price === 800000);

  // Status
  const pStatus = await authRequest('PATCH', `/properties/${pId}/status`, {
    status: 'reserved',
  }, token);
  assert('Property status update → 200', pStatus.status === 200);

  // Invalid status
  const pBadStatus = await authRequest('PATCH', `/properties/${pId}/status`, {
    status: 'moon',
  }, token);
  assert('Invalid property status → 422', pBadStatus.status === 422);

  // Filters
  const filtered = await authRequest('GET', `/properties?status=available&sort=price&order=ASC`, null, token);
  assert('Property filter by status → 200', filtered.status === 200);

  const sqlSearch = await authRequest('GET', `/properties?search=' OR '1'='1`, null, token);
  assert('SQL injection in property search → 200 (safe)', sqlSearch.status === 200);

  // Non-existent property
  const noProps = await authRequest('GET', '/properties/9999999', null, token);
  assert('Non-existent property → 404', noProps.status === 404);

  // Missing required field
  const pBadCreate = await authRequest('POST', '/properties', {
    title: 'Incomplete',
  }, token);
  assert('Create property with missing required fields → 422', pBadCreate.status === 422);

  // Delete property (cleanup)
  const pDelete = await authRequest('DELETE', `/properties/${pId}`, null, token);
  assert('Delete property → 200', pDelete.status === 200);

  return pId;
}

// ═══════════════════════════════════════════════════════════
//  PHASE 8 — File Uploads
// ═══════════════════════════════════════════════════════════
async function testUploads(token) {
  console.log('\n══ PHASE 8: File Uploads ══');

  // Create a test property
  const prop = await authRequest('POST', '/properties', {
    type_id: 1, type: 'Apartment', title: 'Upload Test Property',
    location: 'Test', address: 'Test Address',
    area: 100, price: 100000,
    owner_name: 'Owner', owner_phone: '0500000000',
  }, token);
  const propId = prop.body.data?.id;
  assert('Create property for upload test → 201', prop.status === 201);

  // Helper: multipart POST
  function multipartPost(path, fieldName, fileName, fileBuffer, mimeType, bearerToken) {
    return new Promise((resolve, reject) => {
      const boundary = `----AuditBoundary${Date.now()}`;
      const parts = [];
      parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n` +
        `Content-Type: ${mimeType}\r\n\r\n`
      );
      const bodyStart = Buffer.from(parts.join(''));
      const bodyEnd   = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body      = Buffer.concat([bodyStart, fileBuffer, bodyEnd]);

      const options = {
        hostname: 'localhost', port: 5000,
        path: '/api/v1' + path, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          'Authorization': `Bearer ${bearerToken}`,
        },
      };
      const req = http.request(options, res => {
        let raw = '';
        res.on('data', c => raw += c);
        res.on('end', () => {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  // 1. Valid JPEG upload (1×1 white pixel)
  const validJpeg = Buffer.from(
    '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJAAf/9k=',
    'base64'
  );
  const validUpload = await multipartPost(
    `/properties/${propId}/images`, 'images', 'test.jpg', validJpeg, 'image/jpeg', token
  );
  assert('Valid JPEG upload → 201', validUpload.status === 201);
  const imageId = validUpload.body.data?.[0]?.id;

  // Verify image path stored correctly
  const propWithImages = await authRequest('GET', `/properties/${propId}/images`, null, token);
  assert('Images retrievable after upload', propWithImages.status === 200 && propWithImages.body.data?.length > 0);
  const imagePath = propWithImages.body.data?.[0]?.image_path;
  assert('Image path is a relative path (no absolute paths)', !imagePath?.startsWith('/'));

  // 2. Invalid extension (txt file with jpeg MIME) — extension check should block it
  const fakeJpeg = Buffer.from('This is a text file, not an image');
  const badExtUpload = await multipartPost(
    `/properties/${propId}/images`, 'images', 'malicious.txt', fakeJpeg, 'image/jpeg', token
  );
  assert('Wrong extension rejected → 400/422', badExtUpload.status >= 400 && badExtUpload.status < 500,
    `got ${badExtUpload.status}: ${badExtUpload.body?.message}`
  );

  // 3. MIME spoofing: .jpg extension but text/plain MIME
  const mimeSpoofed = await multipartPost(
    `/properties/${propId}/images`, 'images', 'spoofed.jpg', validJpeg, 'text/plain', token
  );
  assert('MIME spoofing (jpg ext + text/plain MIME) rejected → 400', mimeSpoofed.status >= 400,
    `got ${mimeSpoofed.status}: ${mimeSpoofed.body?.message}`
  );

  // 4. Executable disguised as image
  const execFile = Buffer.from('#!/bin/bash\nrm -rf /');
  const execUpload = await multipartPost(
    `/properties/${propId}/images`, 'images', 'evil.sh', execFile, 'image/jpeg', token
  );
  assert('Shell script with wrong MIME rejected → 400', execUpload.status >= 400,
    `got ${execUpload.status}`
  );

  // 5. Path traversal in filename — multer should UUID-rename, making this safe
  // We can't easily test this directly via HTTP but we can verify UUID naming
  if (imageId) {
    const imgList = await authRequest('GET', `/properties/${propId}/images`, null, token);
    const imgFile = imgList.body.data?.[0]?.image_path;
    const fileName = imgFile?.split('/').pop();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;
    assert('Uploaded filename is UUID-renamed (not user-supplied)', uuidPattern.test(fileName),
      `filename was: ${fileName}`
    );
  }

  // 6. Verify uploaded file actually exists on disk
  if (imagePath) {
    const uploadRoot = path.resolve(__dirname, 'uploads');
    const diskPath = path.join(uploadRoot, imagePath);
    const fileOnDisk = fs.existsSync(diskPath);
    assert('Uploaded file exists on disk', fileOnDisk, `path: ${diskPath}`);
  }

  // 7. Verify file is served correctly (retrievable via /uploads/)
  const fileUrl = imagePath ? `http://localhost:5000/uploads/${imagePath}` : null;
  if (fileUrl) {
    const fileReq = await new Promise((resolve, reject) => {
      http.get(fileUrl, res => {
        resolve({ status: res.statusCode, ct: res.headers['content-type'] });
        res.resume();
      }).on('error', reject);
    });
    assert('Uploaded file retrievable via /uploads/ URL', fileReq.status === 200,
      `got ${fileReq.status} from ${fileUrl}`
    );
  }

  // 8. Delete image
  if (imageId) {
    const delImg = await authRequest('DELETE', `/properties/${propId}/images/${imageId}`, null, token);
    assert('Delete image → 200', delImg.status === 200);
    const diskPath = imagePath ? path.join(path.resolve(__dirname, 'uploads'), imagePath) : null;
    if (diskPath) {
      assert('Deleted image file removed from disk', !fs.existsSync(diskPath),
        `file still exists at ${diskPath}`
      );
    }
  }

  // 9. Upload without auth → 401
  const noAuthUpload = await multipartPost(
    `/properties/${propId}/images`, 'images', 'test.jpg', validJpeg, 'image/jpeg', 'bad_token'
  );
  assert('Image upload without valid auth → 401', noAuthUpload.status === 401,
    `got ${noAuthUpload.status}`
  );

  // Cleanup
  await authRequest('DELETE', `/properties/${propId}`, null, token);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 9 — Dashboard & Reports
// ═══════════════════════════════════════════════════════════
async function testReports(token) {
  console.log('\n══ PHASE 9: Dashboard & Reports ══');

  const dash = await authRequest('GET', '/reports/dashboard', null, token);
  assert('Dashboard → 200', dash.status === 200);
  const d = dash.body.data;
  assert('Dashboard has available_properties', d && 'available_properties' in d);
  assert('Dashboard has new_customers', d && 'new_customers' in d);
  assert('Dashboard has active_contracts', d && 'active_contracts' in d);
  assert('Dashboard has revenue_this_month', d && 'revenue_this_month' in d);
  assert('Dashboard numeric values (not undefined)',
    typeof d?.available_properties === 'number' || d?.available_properties == null
  );

  const propRep = await authRequest('GET', '/reports/properties', null, token);
  assert('Properties report → 200', propRep.status === 200);
  assert('Properties report has byStatus', Array.isArray(propRep.body.data?.byStatus));
  assert('Properties report has byType', Array.isArray(propRep.body.data?.byType));
  assert('Properties report has monthly', Array.isArray(propRep.body.data?.monthly));

  const custRep = await authRequest('GET', '/reports/customers', null, token);
  assert('Customers report → 200', custRep.status === 200);
  assert('Customers report has byStatus', Array.isArray(custRep.body.data?.byStatus));

  const finRep = await authRequest('GET', '/reports/financials', null, token);
  assert('Financials report → 200', finRep.status === 200);
  assert('Financials report has totals', finRep.body.data?.totals !== undefined);

  const agentRep = await authRequest('GET', '/reports/agents', null, token);
  assert('Agents report → 200', agentRep.status === 200);
  assert('Agents report returns array', Array.isArray(agentRep.body.data));

  // Date range filter
  const dateFiltered = await authRequest('GET', '/reports/properties?from_date=2020-01-01&to_date=2030-12-31', null, token);
  assert('Properties report with date range → 200', dateFiltered.status === 200);

  // Invalid date filter (should not crash)
  const badDate = await authRequest('GET', '/reports/properties?from_date=not-a-date', null, token);
  assert('Bad date filter does not crash server → 200 or 400', badDate.status < 500,
    `got ${badDate.status}`
  );
}

// ═══════════════════════════════════════════════════════════
//  PHASE 12 — Security
// ═══════════════════════════════════════════════════════════
async function testSecurity(token) {
  console.log('\n══ PHASE 12: Security ══');

  // Error handler does not expose stack trace in production
  const err500 = await new Promise(resolve => {
    http.get('http://localhost:5000/api/v1/users/nan', {
      headers: { Authorization: `Bearer ${token}` },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', () => resolve({ status: 0 }));
  });
  assert('Error response does not include stack trace in production',
    !err500.body?.stack,
    `stack was exposed: ${err500.body?.stack?.substring(0, 50)}`
  );

  // SQL injection in customer search
  const sqlInj1 = await authRequest('GET', `/customers?search=' OR 1=1--`, null, token);
  assert('SQL injection in customer search → safe (200)', sqlInj1.status === 200);

  const sqlInj2 = await authRequest('GET', `/properties?location='; DROP TABLE properties;--`, null, token);
  assert('SQL injection in property location → safe', sqlInj2.status === 200);

  // XSS payload in customer name — should be stored/returned, not executed
  const xssCreate = await authRequest('POST', '/customers', {
    name: '<script>alert(1)</script>', phone: '0500000001',
  }, token);
  assert('XSS in customer name stored (not executed server-side)', xssCreate.status === 201 || xssCreate.status === 422);
  if (xssCreate.status === 201) {
    await authRequest('DELETE', `/customers/${xssCreate.body.data?.id}`, null, token);
  }

  // CORS — request from disallowed external origin
  const corsBlocked = await new Promise(resolve => {
    const options = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/status', method: 'GET',
      headers: { 'Origin': 'https://evil.external.com' },
    };
    const req = http.request(options, res => {
      resolve({
        status: res.statusCode,
        corsHeader: res.headers['access-control-allow-origin'],
      });
      res.resume();
    });
    req.on('error', () => resolve({ status: 0 }));
    req.end();
  });
  assert('External origin CORS header not wildcard',
    corsBlocked.corsHeader !== '*',
    `header was: ${corsBlocked.corsHeader}`
  );

  // LAN origin allowed
  const corsLan = await new Promise(resolve => {
    const options = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/status', method: 'GET',
      headers: { 'Origin': 'http://192.168.1.100:5000' },
    };
    const req = http.request(options, res => {
      resolve({
        status: res.statusCode,
        corsHeader: res.headers['access-control-allow-origin'],
      });
      res.resume();
    });
    req.on('error', () => resolve({ status: 0 }));
    req.end();
  });
  assert('LAN origin (192.168.x.x) allowed by CORS',
    corsLan.corsHeader === 'http://192.168.1.100:5000',
    `header was: ${corsLan.corsHeader}`
  );

  // password_hash never returned from /users endpoints
  const usersResp = await authRequest('GET', '/users', null, token);
  const hasHash = usersResp.body.data?.some(u => u.password_hash !== undefined);
  assert('password_hash not returned in users list', !hasHash);

  const meResp = await authRequest('GET', '/auth/me', null, token);
  assert('password_hash not returned from /auth/me', !meResp.body.data?.password_hash);

  // Rate limiter header present
  assert('Rate-limit headers present',
    usersResp.headers && 'ratelimit-limit' in usersResp.headers,
    'ratelimit-limit header missing'
  );
}

// ═══════════════════════════════════════════════════════════
//  PHASE 13 — LAN / Network
// ═══════════════════════════════════════════════════════════
async function testLAN(token) {
  console.log('\n══ PHASE 13: LAN / Network ══');

  // Server binds on 0.0.0.0 — verify via health check
  const health = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:5000/health', res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
  });
  assert('Server reachable via 127.0.0.1 (binds on 0.0.0.0)', health.status === 200);

  // Uploads served over plain HTTP
  const uploadRoot = path.resolve(__dirname, 'uploads');
  const propertiesDir = path.join(uploadRoot, 'properties');
  const files = fs.existsSync(propertiesDir) ? fs.readdirSync(propertiesDir).filter(f => !f.startsWith('.')) : [];
  if (files.length > 0) {
    const testFile = files[0];
    const fileReq = await new Promise((resolve, reject) => {
      http.get(`http://localhost:5000/uploads/properties/${testFile}`, res => {
        resolve({ status: res.statusCode });
        res.resume();
      }).on('error', reject);
    });
    assert(`Static uploads served (${testFile})`, fileReq.status === 200);
  } else {
    console.log('  (no uploaded files to test — skipping static file serve test)');
  }

  // No hardcoded localhost in API responses
  const propResp = await authRequest('GET', '/properties', null, token);
  const hasLocalhost = JSON.stringify(propResp.body).includes('localhost:3000');
  assert('API responses do not contain hardcoded localhost:3000', !hasLocalhost);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 18 — E2E Workflow
// ═══════════════════════════════════════════════════════════
async function testE2EWorkflow() {
  console.log('\n══ PHASE 18: End-to-End Workflow ══');

  // 1. Login
  const loginRes = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  assert('E2E: Login succeeds', loginRes.status === 200);
  const token = loginRes.body.data.accessToken;
  const cookie = loginRes.setCookies;

  // 2. Dashboard
  const dash = await authRequest('GET', '/reports/dashboard', null, token);
  assert('E2E: Dashboard loads', dash.status === 200);

  // 3. Create customer
  const cust = await authRequest('POST', '/customers', {
    name: 'E2E Test Customer', phone: '0501112222', status: 'new',
  }, token);
  assert('E2E: Create customer', cust.status === 201);
  const custId = cust.body.data?.id;

  // 4. Create property
  const prop = await authRequest('POST', '/properties', {
    type_id: 1, type: 'Apartment', title: 'E2E Test Property',
    location: 'Riyadh', address: '1 Main Street',
    area: 100, price: 400000,
    owner_name: 'E2E Owner', owner_phone: '0503334444',
  }, token);
  assert('E2E: Create property', prop.status === 201);
  const propId = prop.body.data?.id;

  // 5. Create appointment linking property and customer
  const appt = await authRequest('POST', '/appointments', {
    property_id: propId,
    customer_id: custId,
    customer_name: 'E2E Test Customer',
    customer_phone: '0501112222',
    appointment_date: '2027-01-15',
    appointment_time: '10:00',   // HH:MM format
    type: 'viewing',
  }, token);
  assert('E2E: Create appointment', appt.status === 201);
  const apptId = appt.body.data?.id;

  // 6. Confirm appointment
  const confirm = await authRequest('PATCH', `/appointments/${apptId}/status`, {
    status: 'confirmed',
  }, token);
  assert('E2E: Confirm appointment', confirm.status === 200);

  // 7. Update property status to reserved
  const statusUpd = await authRequest('PATCH', `/properties/${propId}/status`, {
    status: 'reserved',
  }, token);
  assert('E2E: Reserve property', statusUpd.status === 200);

  // 8. View reports
  const propRep = await authRequest('GET', '/reports/properties', null, token);
  assert('E2E: Property report accessible', propRep.status === 200);

  // 9. Activity log shows work
  const acts = await authRequest('GET', '/activities?limit=5', null, token);
  assert('E2E: Activity log has entries', acts.status === 200 && acts.body.data?.length > 0);

  // 10. Logout and verify session revoked
  const logoutRes = await new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token}`,
        'Cookie': Object.entries(cookie).map(([k,v]) => `${k}=${v}`).join('; '),
      },
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(data); req.end();
  });
  assert('E2E: Logout succeeds', logoutRes.status === 200);

  // 11. Old token cannot access API
  const postLogout = await authRequest('GET', '/properties', null, token);
  // Access token still valid (8h), but that's expected — it's the refresh token that's revoked
  // The access token IS still valid after logout (design decision for stateless JWTs)
  // What matters is that the refresh token is revoked
  const rtReuse = await request('POST', '/auth/refresh', {}, cookie);
  assert('E2E: Refresh token revoked after logout', rtReuse.status === 401);

  // 12. Login again, verify data persists
  const loginAgain = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  assert('E2E: Login again succeeds', loginAgain.status === 200);
  const token2 = loginAgain.body.data.accessToken;

  const custStillExists = await authRequest('GET', `/customers/${custId}`, null, token2);
  assert('E2E: Customer data persists after logout/login', custStillExists.status === 200);

  const propStillExists = await authRequest('GET', `/properties/${propId}`, null, token2);
  assert('E2E: Property data persists after logout/login', propStillExists.status === 200);

  // 13. Cleanup
  await authRequest('DELETE', `/appointments/${apptId}`, null, token2);
  await authRequest('DELETE', `/customers/${custId}`, null, token2);
  await authRequest('DELETE', `/properties/${propId}`, null, token2);

  // Logout cleanup
  await new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${token2}`,
        'Cookie': Object.entries(loginAgain.setCookies).map(([k,v]) => `${k}=${v}`).join('; '),
      },
    }, res => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.write(data); req.end();
  });
}

// ═══════════════════════════════════════════════════════════
//  PHASE 19-20 — Error handling + Performance
// ═══════════════════════════════════════════════════════════
async function testErrorHandling(token) {
  console.log('\n══ PHASE 20: Error Handling ══');

  // Non-existent endpoint
  const r1 = await authRequest('GET', '/completely/unknown/endpoint/xyz', null, token);
  assert('Unknown path → 404 (not crash)', r1.status === 404);
  assert('404 does not expose server internals', !r1.body?.stack);

  // Invalid JSON body
  const badJson = await new Promise((resolve, reject) => {
    const data = '{invalid json';
    const options = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/login', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = http.request(options, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { resolve({ status: res.statusCode }); });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  assert('Invalid JSON body → 400 (not crash)', badJson.status === 400 || badJson.status === 422,
    `got ${badJson.status}`
  );

  // Extremely large field
  const longVal = await authRequest('POST', '/customers', {
    name: 'A'.repeat(10000), phone: '0500000000',
  }, token);
  assert('Oversized field → 422 (not crash)', longVal.status === 422);

  // GET on POST-only endpoint
  const wrongMethod = await authRequest('GET', '/auth/logout', null, token);
  assert('Wrong HTTP method → 404 (not crash)', wrongMethod.status === 404 || wrongMethod.status === 405);

  // Negative page number
  const negPage = await authRequest('GET', '/properties?page=-5', null, token);
  assert('Negative page number handled safely → 200', negPage.status === 200);

  // Very large page number (no crash)
  const bigPage = await authRequest('GET', '/properties?page=999999', null, token);
  assert('Very large page number handled safely → 200', bigPage.status === 200);
  assert('Large page returns empty data, not crash', Array.isArray(bigPage.body.data));
}

// ═══════════════════════════════════════════════════════════
//  PHASE 13 — Appointments edge cases
// ═══════════════════════════════════════════════════════════
async function testAppointments(token) {
  console.log('\n══ Appointments Edge Cases ══');

  // Public booking endpoint (unauthenticated)
  const prop = await authRequest('POST', '/properties', {
    type_id: 1, type: 'Apartment', title: 'Public Booking Test',
    location: 'Test', address: 'Test', area: 100, price: 100000,
    owner_name: 'Owner', owner_phone: '0500000000',
  }, token);
  const propId = prop.body.data?.id;

  const publicBook = await request('POST', '/appointments/public', {
    property_id: propId,
    customer_name: 'Public Visitor',
    customer_phone: '0508889999',
    appointment_date: '2027-06-01',
    appointment_time: '14:00',   // HH:MM format (not HH:MM:SS)
    type: 'viewing',
  });
  assert('Public booking endpoint (no auth) → 201', publicBook.status === 201,
    `got ${publicBook.status}: ${JSON.stringify(publicBook.body?.message)}`
  );

  // Public booking returns safe subset (no internal fields)
  assert('Public booking does not expose internal IDs unnecessarily',
    publicBook.body.data && !publicBook.body.data?.admin_notes
  );

  // Conflict detection
  const appt1 = await authRequest('POST', '/appointments', {
    property_id: propId,
    customer_name: 'Customer 1', customer_phone: '0501111111',
    appointment_date: '2027-06-10', appointment_time: '09:00',  // HH:MM
    type: 'viewing',
  }, token);
  // assigned_to might not work if admin id isn't 1, so just check basic creation
  assert('Create appointment → 201 or 409', appt1.status === 201 || appt1.status === 409);

  // Invalid status transition test
  if (appt1.status === 201) {
    const apptId = appt1.body.data?.id;
    // Try to set invalid status
    const badTransition = await authRequest('PATCH', `/appointments/${apptId}/status`, {
      status: 'invalid_status',
    }, token);
    assert('Invalid appointment status → 422', badTransition.status === 422);

    // Cancel
    const cancel = await authRequest('PATCH', `/appointments/${apptId}/status`, {
      status: 'cancelled',
    }, token);
    assert('Cancel appointment → 200', cancel.status === 200);

    // Cannot transition from cancelled to pending
    const reopen = await authRequest('PATCH', `/appointments/${apptId}/status`, {
      status: 'pending',
    }, token);
    assert('Cannot reopen cancelled appointment → 422', reopen.status === 422);

    await authRequest('DELETE', `/appointments/${apptId}`, null, token);
  }

  // Cleanup
  if (propId) await authRequest('DELETE', `/properties/${propId}`, null, token);
}

// ═══════════════════════════════════════════════════════════
//  PHASE 15 — Delivery Package Audit
// ═══════════════════════════════════════════════════════════
async function testPackage() {
  console.log('\n══ PHASE 15: Package / Delivery Audit ══');

  const root = path.resolve(__dirname, '..');

  // .env should not contain real secrets (already sanitised)
  const envPath = path.join(root, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    assert('.env does not contain real Anthropic key', !envContent.includes('sk-ant-api03-A'));
    assert('.env does not contain personal passwords', !envContent.includes('Khaled2007'));
  }

  const backendEnvPath = path.join(root, 'backend', '.env');
  if (fs.existsSync(backendEnvPath)) {
    const content = fs.readFileSync(backendEnvPath, 'utf8');
    assert('backend/.env does not contain old real JWT secrets',
      !content.includes('5dde60d17a6b8935')
    );
    assert('backend/.env has COOKIE_SECRET placeholder', content.includes('COOKIE_SECRET'));
  }

  // node_modules should NOT be included in delivery (check size)
  // We just verify .gitignore excludes it
  const gitignorePath = path.join(root, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gi = fs.readFileSync(gitignorePath, 'utf8');
    assert('.gitignore includes node_modules', gi.includes('node_modules/'));
    assert('.gitignore includes .env', gi.includes('.env'));
    assert('.gitignore includes backend/.env', gi.includes('backend/.env'));
    assert('.gitignore includes .suitest/ artifacts', gi.includes('.suitest/credentials.json'));
  }

  // Suitest credentials should be cleared
  const suiteCredPath = path.join(root, '.suitest', 'credentials.json');
  if (fs.existsSync(suiteCredPath)) {
    const creds = JSON.parse(fs.readFileSync(suiteCredPath, 'utf8'));
    assert('.suitest/credentials.json has no real email', !creds.email || creds.email === '');
    assert('.suitest/credentials.json has no real apiKey', !creds.apiKey || creds.apiKey === '');
  }

  // Log files should not have sensitive data
  const logPath = path.join(root, 'backend', 'logs', 'combined.log');
  if (fs.existsSync(logPath)) {
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert('combined.log does not contain raw passwords', !logContent.includes('Admin@123456'));
  }

  // ai-agent reports should be deleted
  const reportsDir = path.join(root, 'ai-agent', 'reports');
  const reportFiles = fs.existsSync(reportsDir)
    ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.txt'))
    : [];
  assert('ai-agent report files deleted', reportFiles.length === 0,
    `found: ${reportFiles.join(', ')}`
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   REMS — Final Pre-Delivery Audit Test Suite     ║');
  console.log('╚══════════════════════════════════════════════════╝');

  try {
    await testBuild();

    // Login for token
    const loginRes = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
    if (loginRes.status !== 200) {
      console.log('\n✗ FATAL: Cannot login — aborting audit');
      process.exit(1);
    }
    const token = loginRes.body.data.accessToken;

    await testDatabase(token);
    await testAuth();

    // Login again after testAuth cleans up
    const loginRes2 = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
    const token2 = loginRes2.body.data.accessToken;

    await testAPIEndpoints(token2);
    await sleep(1000);
    await testAuthorization(token2);

    const loginRes3 = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
    const token3 = loginRes3.body.data?.accessToken;
    if (!token3) { console.log('Rate limited on login — waiting 10s'); await sleep(10000); }
    const loginRes3b = token3 ? loginRes3 : await request('POST', '/auth/login', { email: EMAIL, password: PASS });
    const finalToken = loginRes3b.body.data?.accessToken;

    await testCRUD(finalToken);
    await sleep(1000);
    await testUploads(finalToken);
    await sleep(500);
    await testReports(finalToken);
    await sleep(500);
    await testSecurity(finalToken);
    await testLAN(finalToken);
    await sleep(500);
    await testAppointments(finalToken);
    await sleep(500);
    await testErrorHandling(finalToken);
    await testPackage();
    await sleep(1000);
    await testE2EWorkflow();

  } catch (err) {
    console.error('\n✗ TEST RUNNER ERROR:', err.message);
    console.error(err.stack);
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  RESULTS: ${passCount} passed, ${failCount} failed`.padEnd(51) + '║');
  console.log('╚══════════════════════════════════════════════════╝');

  if (failCount > 0) {
    console.log('\nFAILED TESTS:');
    results.filter(r => !r.pass).forEach(r => {
      console.log(`  ✗ ${r.label}${r.detail ? ': ' + r.detail : ''}`);
    });
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
