const mysql = require('mysql2/promise');
(async () => {
  try {
    const pool = mysql.createPool({
      host: 'localhost',
      user: 'CafeTest',
      password: 'CafeTestPW',
      database: 'cafe_orders',
    });
    const [rows] = await pool.query('SELECT * FROM orders');
    console.log('rows:', rows);
    await pool.end();
  } catch (err) {
    console.error('db error', err);
  }
})();