'use strict';
// Minimal debug test for rotation
const http = require('http');

function req(method, path, body, cookies) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : JSON.stringify({});
    const cookieStr = cookies ? Object.entries(cookies).map(([k,v]) => `${k}=${v}`).join('; ') : '';
    const opts = {
      hostname: 'localhost', port: 5000,
      path: '/api/v1' + path, method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(cookieStr ? { Cookie: cookieStr } : {}),
      },
    };
    const request = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        const setCookies = {};
        (res.headers['set-cookie'] || []).forEach(c => {
          const [pair] = c.split(';');
          const [k, v] = pair.split('=');
          if (k && v !== undefined) setCookies[k.trim()] = v.trim();
        });
        resolve({ status: res.statusCode, body: JSON.parse(raw), setCookies });
      });
    });
    request.on('error', reject);
    request.write(data);
    request.end();
  });
}

async function run() {
  console.log('=== Debug: Single rotation cycle ===\n');

  // Login
  const L = await req('POST', '/auth/login', { email: 'admin@test.com', password: 'Admin@123456' });
  const loginCookie = L.setCookies.rems_rt;
  console.log('1. Login status:', L.status);
  console.log('   Login cookie prefix:', loginCookie ? loginCookie.substring(0,20) + '...' : 'NONE');
  console.log('   setCookies keys:', Object.keys(L.setCookies));

  // Refresh #1 — uses login cookie
  const R1 = await req('POST', '/auth/refresh', {}, { rems_rt: loginCookie });
  const refreshCookie1 = R1.setCookies.rems_rt;
  console.log('\n2. Refresh #1 status:', R1.status);
  console.log('   Refresh #1 message:', R1.body.message);
  console.log('   New cookie prefix:', refreshCookie1 ? refreshCookie1.substring(0,20) + '...' : 'NONE (NO NEW COOKIE SET!)');
  console.log('   setCookies keys:', Object.keys(R1.setCookies));
  console.log('   Login cookie === Refresh cookie:', loginCookie === refreshCookie1);

  // Reuse login cookie — must fail
  const R2 = await req('POST', '/auth/refresh', {}, { rems_rt: loginCookie });
  console.log('\n3. Reuse login cookie status:', R2.status, '(expected 401)');
  console.log('   Message:', R2.body.message);
  if (R2.status !== 401) {
    console.log('   *** ROTATION FAILED — old cookie still works ***');
    // Show DB state
  } else {
    console.log('   *** ROTATION CORRECT — old cookie rejected ***');
  }

  // Use new cookie if it was set
  if (refreshCookie1 && refreshCookie1 !== loginCookie) {
    const R3 = await req('POST', '/auth/refresh', {}, { rems_rt: refreshCookie1 });
    console.log('\n4. New cookie works:', R3.status, '(expected 200)');
  } else {
    console.log('\n4. SKIP: no new cookie was set in Refresh #1 response');
    console.log('   This means the server did not Set-Cookie on refresh');
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
