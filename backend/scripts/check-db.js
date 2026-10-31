'use strict';
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
  });

  const [tables] = await conn.execute('SHOW TABLES');
  console.log('\n=== Tables in DB ===');
  tables.forEach((r) => console.log(' -', Object.values(r)[0]));

  const [views] = await conn.execute("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
  console.log('\n=== Views ===');
  views.forEach((r) => console.log(' -', Object.values(r)[0]));

  const [userCols] = await conn.execute('DESCRIBE users');
  console.log('\n=== users columns ===');
  console.log(userCols.map((c) => c.Field).join(', '));

  const [imgCols] = await conn.execute('DESCRIBE property_images');
  console.log('\n=== property_images columns ===');
  console.log(imgCols.map((c) => c.Field).join(', '));

  const [ptCols] = await conn.execute('DESCRIBE property_types');
  console.log('\n=== property_types columns ===');
  console.log(ptCols.map((c) => c.Field).join(', '));

  const [actCols] = await conn.execute('DESCRIBE activities');
  console.log('\n=== activities columns ===');
  console.log(actCols.map((c) => c.Field).join(', '));

  await conn.end();
  console.log('\n✅ DB sanity check passed.\n');
})().catch((e) => {
  console.error('DB CHECK FAILED:', e.message);
  process.exit(1);
});
