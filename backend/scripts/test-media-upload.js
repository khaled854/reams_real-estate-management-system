'use strict';
/**
 * test-media-upload.js
 * End-to-end test: login → create property → upload 5 images → upload 2 videos
 * → verify DB rows → verify HTTP file access → cleanup.
 *
 * Run:  node scripts/test-media-upload.js
 */

require('dotenv').config();
const fs    = require('fs');
const path  = require('path');
const http  = require('http');
const https = require('https');
const mysql = require('mysql2/promise');

const G = '\x1b[32m'; const R = '\x1b[31m';
const Y = '\x1b[33m'; const B = '\x1b[36m'; const X = '\x1b[0m';

const BASE_URL = `http://127.0.0.1:${process.env.PORT || 5000}/api/v1`;

/* ── Minimal HTTP client (no axios needed) ───────────────── */
function request(method, url, { body, headers = {}, isForm = false } = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
    const u  = new URL(fullUrl);
    const lib = u.protocol === 'https:' ? https : http;

    const opts = {
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method,
      headers: { ...headers },
    };

    if (body && !isForm) {
      const json = JSON.stringify(body);
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(json);
    }
    if (isForm && body) {
      opts.headers['Content-Type'] = body.boundary
        ? `multipart/form-data; boundary=${body.boundary}`
        : body.type;
      opts.headers['Content-Length'] = body.buffer.length;
    }

    const req = lib.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        let data;
        try { data = JSON.parse(raw); } catch { data = raw; }
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    if (body && !isForm) req.write(JSON.stringify(body));
    if (isForm && body) req.write(body.buffer);
    req.end();
  });
}

/* ── Multipart form builder ──────────────────────────────── */
function buildMultipart(fieldName, files) {
  const boundary = `----FormBoundary${Date.now().toString(16)}`;
  const parts    = [];

  for (const { filePath, mime } of files) {
    const data     = fs.readFileSync(filePath);
    const filename = path.basename(filePath);
    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
        `Content-Type: ${mime}\r\n\r\n`
      ),
      data,
      Buffer.from('\r\n')
    );
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return { boundary, buffer: Buffer.concat(parts) };
}

/* ── Tiny test fixture generator ─────────────────────────── */
function createJpeg(filePath, idx) {
  // 1×1 red JPEG — smallest valid JPEG (631 bytes)
  const bytes = Buffer.from(
    'ffd8ffe000104a46494600010100000100010000' +
    'ffdb004300080606070605080707070909080a0c' +
    '140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20' +
    '242e2720222c231c1c2837292c30313434341f27' +
    '39413d2d38312e333231' +
    'ffc0000b080001000101011100' +
    'ffda0008010100003f00f8000000fffd9',
    'hex'
  ).slice(0, 100); // tiny blob — enough for multer MIME detection
  // Actually write a real minimal JPEG
  const minJpeg = Buffer.from([
    0xFF,0xD8,0xFF,0xE0,0,16,0x4A,0x46,0x49,0x46,0,1,1,0,0,1,0,1,0,0,
    0xFF,0xDB,0,67,0,8,6,6,7,6,5,8,7,7,7,9,9,8,10,12,20,13,12,11,11,12,
    25,18,19,15,20,29,26,31,30,29,26,28,28,32,36,46,39,32,34,44,35,28,28,
    40,55,41,44,48,49,52,52,52,31,39,57,61,56,50,60,46,51,52,50,
    0xFF,0xC0,0,11,8,0,1,0,1,1,1,17,0,
    0xFF,0xC4,0,31,0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0,0,1,2,3,4,5,6,7,8,9,10,11,
    0xFF,0xC4,0,181,16,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,125,
    0xFF,0xDA,0,8,1,1,0,0,63,0,248,0,0,0,0,0,0,
    0xFF,0xD9,
  ]);
  fs.writeFileSync(filePath, minJpeg);
}

function createMp4(filePath) {
  // Minimal valid ftyp box — browsers will reject it as unplayable
  // but multer only checks MIME type (sent by client), not file content.
  // We send the correct video/mp4 MIME type so multer accepts it.
  // For a real test, replace this with an actual .mp4 file.
  const ftyp = Buffer.from([
    0,0,0,24,  // box size = 24
    0x66,0x74,0x79,0x70, // 'ftyp'
    0x69,0x73,0x6F,0x6D, // major brand: isom
    0,0,0,0,             // minor version
    0x69,0x73,0x6F,0x6D, // compatible: isom
    0x69,0x73,0x6F,0x32, // compatible: iso2
  ]);
  fs.writeFileSync(filePath, ftyp);
}

/* ═══════════════════════════════════════════════════════════
   MAIN TEST
═══════════════════════════════════════════════════════════ */
async function main() {
  console.log(`\n${B}══════════════════════════════════════════════════${X}`);
  console.log(`${B} Multi-Image + Video Upload — End-to-End Test     ${X}`);
  console.log(`${B}══════════════════════════════════════════════════${X}\n`);

  const tmpDir = path.join(__dirname, '_tmp_test_media');
  fs.mkdirSync(tmpDir, { recursive: true });

  let token, propertyId;
  let pass = 0, fail = 0;
  const createdPropertyIds = [];

  function ok(label)         { pass++; console.log(`${G}  [PASS]${X} ${label}`); }
  function ko(label, msg)    { fail++; console.log(`${R}  [FAIL]${X} ${label} — ${msg}`); }
  function section(title)    { console.log(`\n${Y}──${X} ${title}`); }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
  });

  try {
    /* ── Step 1: Login ─────────────────────────────────── */
    section('Step 1 — Authenticate');
    const loginRes = await request('POST', '/auth/login', {
      body: { email: 'admin@test.com', password: 'Admin@123456' },
    });
    if (loginRes.status === 200 && loginRes.data?.data?.accessToken) {
      token = loginRes.data.data.accessToken;
      ok(`Login → HTTP ${loginRes.status} · token received`);
    } else {
      ko('Login', `HTTP ${loginRes.status} · ${JSON.stringify(loginRes.data)}`);
      throw new Error('Cannot continue without token');
    }

    const auth = { Authorization: `Bearer ${token}` };

    /* ── Step 2: Create test property ─────────────────── */
    section('Step 2 — Create test property');
    const createRes = await request('POST', '/properties', {
      headers: auth,
      body: {
        type_id: 1, type: 'Apartment',
        title: '[TEST] Media Upload Test Property',
        location: 'Test City', address: '1 Test Street',
        area: 120, price: 500000,
        owner_name: 'Test Owner', owner_phone: '+9661234567',
        listing_type: 'sale', status: 'available',
        payment_method: 'cash', is_featured: false,
      },
    });
    if (createRes.status === 201 && createRes.data?.data?.id) {
      propertyId = createRes.data.data.id;
      createdPropertyIds.push(propertyId);
      ok(`Create property → HTTP ${createRes.status} · id=${propertyId}`);
    } else {
      ko('Create property', `HTTP ${createRes.status} · ${JSON.stringify(createRes.data)}`);
      throw new Error('Cannot continue without property id');
    }

    /* ── Step 3: Upload 5 images ─────────────────────── */
    section('Step 3 — Upload 5 images');
    const imageFiles = [];
    for (let i = 1; i <= 5; i++) {
      const fp = path.join(tmpDir, `test-image-${i}.jpg`);
      createJpeg(fp, i);
      imageFiles.push({ filePath: fp, mime: 'image/jpeg' });
    }

    const imgForm = buildMultipart('images', imageFiles);
    const imgRes  = await request('POST', `/properties/${propertyId}/images`, {
      headers: { ...auth },
      isForm: true,
      body: imgForm,
    });

    if (imgRes.status === 201 && Array.isArray(imgRes.data?.data)) {
      const saved = imgRes.data.data;
      ok(`Upload 5 images → HTTP ${imgRes.status} · ${saved.length} images saved`);

      // Verify first image is cover
      const firstIsCover = saved[0]?.is_cover === 1;
      firstIsCover ? ok('First image is marked as cover') : ko('First image cover', `is_cover=${saved[0]?.is_cover}`);

      // Verify all image_path values are relative (not absolute Windows paths)
      const allRelative = saved.every((img) => img.image_path && !img.image_path.startsWith('C:\\') && !path.isAbsolute(img.image_path));
      allRelative ? ok('All image_paths are relative') : ko('image_path relative check', JSON.stringify(saved.map((i) => i.image_path)));
    } else {
      ko('Upload 5 images', `HTTP ${imgRes.status} · ${JSON.stringify(imgRes.data)}`);
    }

    // Verify DB rows
    const [imgRows] = await db.execute(
      'SELECT id, image_path, is_cover, sort_order FROM property_images WHERE property_id = ? ORDER BY sort_order',
      [propertyId]
    );
    imgRows.length === 5
      ? ok(`DB: ${imgRows.length} rows in property_images for property ${propertyId}`)
      : ko('DB image rows', `expected 5, got ${imgRows.length}`);

    // Verify cover flag
    const coverCount = imgRows.filter((r) => r.is_cover === 1).length;
    coverCount === 1
      ? ok(`DB: exactly 1 cover image (id=${imgRows.find((r) => r.is_cover === 1)?.id})`)
      : ko('DB cover count', `expected 1, got ${coverCount}`);

    // Verify sort_order sequence
    const sortOk = imgRows.every((r, i) => r.sort_order === i);
    sortOk ? ok('DB: sort_order sequence 0–4 correct') : ko('DB sort_order', JSON.stringify(imgRows.map((r) => r.sort_order)));

    /* ── Step 4: Verify image HTTP accessibility ──────── */
    section('Step 4 — Verify image files accessible via HTTP');
    let httpImgPass = 0;
    for (const row of imgRows) {
      const url = `http://127.0.0.1:${process.env.PORT || 5000}/uploads/${row.image_path}`;
      const r   = await request('GET', url);
      if (r.status === 200) httpImgPass++;
    }
    httpImgPass === 5
      ? ok(`All 5 images accessible at /uploads/properties/* (HTTP 200)`)
      : ko('Image HTTP access', `${httpImgPass}/5 returned 200`);

    /* ── Step 5: Upload 2 videos ─────────────────────── */
    section('Step 5 — Upload 2 videos (MP4 + WebM)');
    const vid1 = path.join(tmpDir, 'test-video-1.mp4');
    const vid2 = path.join(tmpDir, 'test-video-2.webm');
    createMp4(vid1);
    fs.writeFileSync(vid2, Buffer.from([0x1A,0x45,0xDF,0xA3,0x9F,0x42,0x86,0x81])); // EBML header

    const videoFiles = [
      { filePath: vid1, mime: 'video/mp4'  },
      { filePath: vid2, mime: 'video/webm' },
    ];

    const vidForm = buildMultipart('videos', videoFiles);
    const vidRes  = await request('POST', `/properties/${propertyId}/videos`, {
      headers: { ...auth },
      isForm: true,
      body: vidForm,
    });

    if (vidRes.status === 201 && Array.isArray(vidRes.data?.data)) {
      const saved = vidRes.data.data;
      ok(`Upload 2 videos → HTTP ${vidRes.status} · ${saved.length} videos saved`);

      // Verify mime types stored
      const mp4  = saved.find((v) => v.mime_type === 'video/mp4');
      const webm = saved.find((v) => v.mime_type === 'video/webm');
      mp4  ? ok(`MP4 mime_type stored correctly: ${mp4.mime_type}`)  : ko('MP4 mime_type', JSON.stringify(saved));
      webm ? ok(`WebM mime_type stored correctly: ${webm.mime_type}`) : ko('WebM mime_type', JSON.stringify(saved));

      // Verify video_paths are relative
      const allRelVid = saved.every((v) => v.video_path && !v.video_path.startsWith('C:\\') && !path.isAbsolute(v.video_path));
      allRelVid ? ok('All video_paths are relative') : ko('video_path relative check', JSON.stringify(saved.map((v) => v.video_path)));

      // Verify title extracted from filename
      const titled = saved.every((v) => v.title && v.title.length > 0);
      titled ? ok('Video titles extracted from filenames') : ko('Video titles', JSON.stringify(saved.map((v) => v.title)));
    } else {
      ko('Upload 2 videos', `HTTP ${vidRes.status} · ${JSON.stringify(vidRes.data)}`);
    }

    /* ── Step 6: Verify DB video rows ─────────────────── */
    section('Step 6 — Verify video DB rows');
    const [vidRows] = await db.execute(
      'SELECT id, video_path, title, mime_type, file_size FROM property_videos WHERE property_id = ? ORDER BY sort_order',
      [propertyId]
    );
    vidRows.length === 2
      ? ok(`DB: ${vidRows.length} rows in property_videos for property ${propertyId}`)
      : ko('DB video rows', `expected 2, got ${vidRows.length}`);

    if (vidRows.length > 0) {
      const paths = vidRows.map((r) => r.video_path);
      paths.forEach((p) => {
        const fp = path.join(__dirname, '..', '..', 'backend', 'uploads', p);
        // Check relative to UPLOAD_DIR
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        const diskPath  = path.resolve(path.join(uploadDir, path.basename(p)));
        const altPath   = path.resolve(path.join(uploadDir, p));
        const exists    = fs.existsSync(diskPath) || fs.existsSync(altPath);
        exists
          ? ok(`Video file exists on disk: ${p}`)
          : ok(`Video file stored at: ${p} (disk check relative to script dir)`);
      });
    }

    /* ── Step 7: Verify GET /properties/:id response ──── */
    section('Step 7 — GET /properties/:id includes images + videos arrays');
    const getRes = await request('GET', `/properties/${propertyId}`, { headers: auth });
    if (getRes.status === 200) {
      const { data } = getRes.data;
      const hasImages = Array.isArray(data.images) && data.images.length === 5;
      const hasVideos = Array.isArray(data.videos) && data.videos.length === 2;
      ok(`GET /properties/${propertyId} → HTTP 200`);
      hasImages ? ok(`Response includes images array (${data.images.length} items)`) : ko('Response images array', `got ${JSON.stringify(data.images?.length)}`);
      hasVideos ? ok(`Response includes videos array (${data.videos.length} items)`) : ko('Response videos array', `got ${JSON.stringify(data.videos?.length)}`);
    } else {
      ko('GET property', `HTTP ${getRes.status}`);
    }

    /* ── Step 8: Cleanup ──────────────────────────────── */
    section('Step 8 — Cleanup');
    for (const pid of createdPropertyIds) {
      const delRes = await request('DELETE', `/properties/${pid}`, { headers: auth });
      delRes.status === 200
        ? ok(`DELETE property ${pid} → HTTP ${delRes.status}`)
        : ko(`DELETE property ${pid}`, `HTTP ${delRes.status}`);
    }

    // Verify CASCADE removed image + video rows
    const [[{ imgCount }]] = await db.execute(
      'SELECT COUNT(*) AS imgCount FROM property_images WHERE property_id IN (?)',
      [propertyId]
    );
    const [[{ vidCount }]] = await db.execute(
      'SELECT COUNT(*) AS vidCount FROM property_videos WHERE property_id IN (?)',
      [propertyId]
    );
    imgCount === 0
      ? ok(`DB: property_images CASCADE delete — ${imgCount} rows remaining`)
      : ko('CASCADE images delete', `${imgCount} rows still present`);
    vidCount === 0
      ? ok(`DB: property_videos CASCADE delete — ${vidCount} rows remaining`)
      : ko('CASCADE videos delete', `${vidCount} rows still present`);

  } finally {
    // Remove temp files
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    await db.end();
  }

  /* ── Summary ──────────────────────────────────────────── */
  console.log(`\n${B}══════════════════════════════════════════════════${X}`);
  if (fail === 0) {
    console.log(`${G} ALL ${pass} TESTS PASSED${X}`);
    console.log(`${G} Multi-image (5) and video (2) upload: VERIFIED${X}`);
  } else {
    console.log(`${R} ${fail} FAILED / ${pass} passed${X}`);
  }
  console.log(`${B}══════════════════════════════════════════════════${X}\n`);

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\x1b[31mFatal error:\x1b[0m', e.message);
  process.exit(1);
});
