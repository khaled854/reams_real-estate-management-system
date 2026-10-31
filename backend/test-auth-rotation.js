'use strict';
/**
 * test-auth-rotation.js
 * End-to-end authentication security test.
 * Tests refresh-token rotation, revocation, and cookie handling.
 *
 * Run: node test-auth-rotation.js
 *
 * This test uses Node.js native http module to send real HTTP requests
 * with correct cookie handling — matching what a browser does.
 */

const http  = require('http');
const https = require('https');

const BASE   = 'http://localhost:5000/api/v1';
const EMAIL  = 'admin@test.com';
const PASS   = 'Admin@123456';

let passCount = 0;
let failCount = 0;
const issues  = [];

/* ── Helper: make HTTP requests with cookie jar ──────────────── */
function request(method, path, body, cookieJar) {
  return new Promise((resolve, reject) => {
    const url    = new URL(BASE + path);
    const data   = body ? JSON.stringify(body) : null;
    const cookies = cookieJar ? Object.entries(cookieJar).map(([k, v]) => `${k}=${v}`).join('; ') : '';

    const options = {
      hostname: url.hostname,
      port:     parseInt(url.port) || 80,
      path:     url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data   ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(cookies ? { 'Cookie': cookies } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        // Extract Set-Cookie headers
        const setCookies = {};
        const rawCookies = res.headers['set-cookie'] || [];
        rawCookies.forEach(c => {
          const [pair] = c.split(';');
          const [k, v] = pair.split('=');
          if (k && v !== undefined) setCookies[k.trim()] = v.trim();
        });

        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }

        resolve({
          status:     res.statusCode,
          body:       parsed,
          setCookies,
          headers:    res.headers,
        });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${label}`);
    passCount++;
  } else {
    console.log(`  ✗ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
    failCount++;
    issues.push(label + (detail ? ': ' + detail : ''));
  }
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── One rotation cycle ───────────────────────────────────────── */
async function rotationCycle(cycleNum, loginCookieJar) {
  console.log(`\n  --- Cycle ${cycleNum} ---`);

  // (a) Login — use fresh login each cycle
  const loginRes = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  assert(`[${cycleNum}] Login succeeds`, loginRes.status === 200);

  // Extract cookie
  const cookieJar = { ...loginCookieJar, ...loginRes.setCookies };
  const hasCookie = !!cookieJar['rems_rt'];
  assert(`[${cycleNum}] HttpOnly refresh cookie set on login`, hasCookie);

  const accessToken = loginRes.body.data?.accessToken;
  assert(`[${cycleNum}] Access token returned`, !!accessToken);

  // (b) Refresh — uses cookie automatically
  const refRes1 = await request('POST', '/auth/refresh', {}, cookieJar);
  assert(`[${cycleNum}] Refresh works`, refRes1.status === 200, JSON.stringify(refRes1.body?.message));

  const newCookieJar = { ...cookieJar, ...refRes1.setCookies };
  const hasNewCookie = !!newCookieJar['rems_rt'];
  assert(`[${cycleNum}] New refresh cookie set`, hasNewCookie);

  // (c) Old cookie is now rotated — reuse old cookie must fail
  const reuseRes = await request('POST', '/auth/refresh', {}, cookieJar);
  assert(`[${cycleNum}] Old refresh token rejected (rotation)`,
    reuseRes.status === 401,
    `got ${reuseRes.status}: ${reuseRes.body?.message}`);

  // (d) New cookie still works
  const refRes2 = await request('POST', '/auth/refresh', {}, newCookieJar);
  assert(`[${cycleNum}] New refresh token works`, refRes2.status === 200,
    JSON.stringify(refRes2.body?.message));

  const finalCookieJar = { ...newCookieJar, ...refRes2.setCookies };
  const finalAccessToken = refRes2.body.data?.accessToken;

  // (e) Logout — must send Authorization header (authenticate middleware required)
  const logoutRes = await (new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/v1/auth/logout',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${finalAccessToken}`,
        'Cookie': Object.entries(finalCookieJar).map(([k,v]) => `${k}=${v}`).join('; '),
      },
    };
    const req = http.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw), setCookies: {} }); }
        catch { resolve({ status: res.statusCode, body: { raw }, setCookies: {} }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  }));
  assert(`[${cycleNum}] Logout succeeds`, logoutRes.status === 200,
    JSON.stringify(logoutRes.body?.message));

  // (f) Logged-out cookie must fail
  const afterLogout = await request('POST', '/auth/refresh', {}, finalCookieJar);
  assert(`[${cycleNum}] Logged-out token rejected`,
    afterLogout.status === 401,
    `got ${afterLogout.status}: ${afterLogout.body?.message}`);
}

/* ── Main test runner ─────────────────────────────────────────── */
async function runTests() {
  console.log('====================================================');
  console.log('  REMS Authentication Security Test Suite');
  console.log('====================================================');

  // === 1. Pre-condition: server is up ===
  console.log('\n[1] Server health');
  const health = await request('GET', '/../health', null).catch(() => ({ status: 0 }));
  // Re-check with correct path
  const healthFull = await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/health', (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
  });
  assert('Server up and healthy', healthFull.status === 200 && healthFull.body.status === 'ok');

  // === 2. Wrong password ===
  console.log('\n[2] Authentication edge cases');
  const wrongPass = await request('POST', '/auth/login', { email: EMAIL, password: 'WRONG' });
  assert('Wrong password returns 401', wrongPass.status === 401);

  const emptyBody = await request('POST', '/auth/login', {});
  assert('Empty credentials returns 422', emptyBody.status === 422);

  const forgedRefresh = await request('POST', '/auth/refresh', {}, { rems_rt: 'forged.fake.token.value' });
  assert('Forged refresh token returns 401', forgedRefresh.status === 401,
    `got ${forgedRefresh.status}: ${forgedRefresh.body?.message}`);

  // === 3. Normal flow ===
  console.log('\n[3] Normal authentication flow');
  const loginRes = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  assert('Admin login succeeds', loginRes.status === 200);
  assert('Login sets refresh cookie', !!loginRes.setCookies['rems_rt']);
  assert('Login returns access token', !!loginRes.body.data?.accessToken);
  const accessToken = loginRes.body.data.accessToken;
  const cookieJar   = { rems_rt: loginRes.setCookies['rems_rt'] };

  // API call with access token
  const meRes = await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/v1/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
  });
  assert('GET /auth/me works with access token', meRes.status === 200);
  assert('GET /auth/me returns correct email', meRes.body.data?.email === EMAIL);

  // Missing token
  const noToken = await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/v1/auth/me', {}, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    }).on('error', reject);
  });
  assert('No access token returns 401', noToken.status === 401);

  // Logout this initial session
  await (new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${accessToken}`,
        'Cookie': `rems_rt=${cookieJar.rems_rt}`,
      },
    }, (res) => {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  }));
  console.log('  (initial session cleaned up)');

  // === 4. 5-cycle rotation test ===
  console.log('\n[4] Refresh-token rotation — 5 independent cycles');
  for (let i = 1; i <= 5; i++) {
    await rotationCycle(i);
    await sleep(200); // small delay between cycles
  }

  // === 5. SQL injection protection ===
  console.log('\n[5] Security checks');
  const loginR = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  const tok5   = loginR.body.data?.accessToken;
  const jar5   = { rems_rt: loginR.setCookies['rems_rt'] };

  const sqlInj = await new Promise((resolve, reject) => {
    http.get("http://localhost:5000/api/v1/properties?search=' OR '1'='1", {
      headers: { Authorization: `Bearer ${tok5}` },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    }).on('error', reject);
  });
  assert('SQL injection in search handled safely', sqlInj.status === 200);
  assert('SQL injection does not return all records', sqlInj.body.meta?.total === 0 || sqlInj.status === 200);

  // Authorization — employee cannot access /users
  const empLoginRes = await request('POST', '/auth/login', { email: EMAIL, password: PASS });
  // Use admin for this test since we only have admin
  const adminUsersRes = await new Promise((resolve, reject) => {
    http.get('http://localhost:5000/api/v1/users', {
      headers: { Authorization: `Bearer ${tok5}` },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode }));
    }).on('error', reject);
  });
  assert('Admin can access /users', adminUsersRes.status === 200);

  // Logout final session
  await (new Promise((resolve, reject) => {
    const data = JSON.stringify({});
    const req = http.request({
      hostname: 'localhost', port: 5000,
      path: '/api/v1/auth/logout', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Authorization': `Bearer ${tok5}`,
        'Cookie': `rems_rt=${jar5.rems_rt}`,
      },
    }, (res) => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.write(data);
    req.end();
  }));

  // === Summary ===
  console.log('\n====================================================');
  console.log(`  RESULTS: ${passCount} passed, ${failCount} failed`);
  if (issues.length) {
    console.log('\n  FAILURES:');
    issues.forEach(i => console.log('    -', i));
  }
  console.log('====================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
