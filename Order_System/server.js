const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const mysql = require('mysql2/promise');
const session = require('express-session');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Session middleware
app.use(session({
  secret: 'cafe-order-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 1000 * 60 * 60 * 8 } // 8 hours
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection pool (without database specified initially)
const primaryPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize database schema and create database if needed
async function initDatabase() {
  try {
    // First, try to create the database if it doesn't exist
    const setupConn = await primaryPool.getConnection();
    const dbName = process.env.DB_NAME || 'cafe_orders';
    await setupConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    setupConn.release();
    console.log('Database created/verified');
  } catch (err) {
    console.error('Failed to create database', err);
  }
}

// Create the main pool that connects to the cafe_orders database
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cafe_orders',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Initialize database and create tables
async function setupTables() {
  try {
    await initDatabase();
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        items TEXT NOT NULL,
        createdBy VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    connection.release();
    console.log('Tables initialized');
  } catch (err) {
    console.error('Failed to initialize tables', err);
  }
}

// Initialize on startup
setupTables();

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const requireKitchen = (req, res, next) => {
  if (!req.session || !req.session.user || req.session.user.role !== 'kitchen') {
    return res.status(403).json({ error: 'Forbidden: kitchen access only' });
  }
  next();
};

// Auth endpoints
app.post('/api/login', (req, res) => {
  const { name, role } = req.body;
  if (!name || !role || !['service', 'kitchen'].includes(role)) {
    return res.status(400).json({ error: 'name and role (service|kitchen) required' });
  }
  req.session.user = { name, role };
  res.json({ success: true, user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

app.get('/api/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json(req.session.user);
  } else {
    res.status(401).json({ error: 'Not logged in' });
  }
});

// API endpoints
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const owner = req.query.owner;
    let query = 'SELECT id, items, createdBy, status, createdAt FROM orders ORDER BY ';
    if (owner) {
      query += `
        CASE 
          WHEN createdBy = ? THEN 0 
          ELSE 1 
        END, 
        id ASC
      `;
      const [rows] = await pool.query(query, [owner]);
      return res.json(rows);
    } else {
      query += 'id ASC';
      const [rows] = await pool.query(query);
      return res.json(rows);
    }
  } catch (err) {
    console.error('Error fetching orders:', err);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const { items } = req.body;
    const createdBy = req.session.user.name;
    if (!items) {
      return res.status(400).json({ error: 'items required' });
    }
    const [result] = await pool.query(
      'INSERT INTO orders (items, createdBy, status, createdAt) VALUES (?, ?, ?, NOW())',
      [items, createdBy, 'pending']
    );
    const orderId = result.insertId;
    const [rows] = await pool.query(
      'SELECT id, items, createdBy, status, createdAt FROM orders WHERE id = ?',
      [orderId]
    );
    const order = rows[0];
    io.emit('orderCreated', order);
    res.status(201).json(order);
  } catch (err) {
    console.error('Error creating order:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.put('/api/orders/:id/status', requireKitchen, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'in progress', 'finished'].includes(status)) {
      return res.status(400).json({ error: 'invalid status' });
    }
    const [result] = await pool.query(
      'UPDATE orders SET status = ?, updatedAt = NOW() WHERE id = ?',
      [status, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'order not found' });
    }
    const [rows] = await pool.query(
      'SELECT id, items, createdBy, status, createdAt FROM orders WHERE id = ?',
      [id]
    );
    const order = rows[0];
    io.emit('orderUpdated', order);
    res.json(order);
  } catch (err) {
    console.error('Error updating order:', err);
    res.status(500).json({ error: 'Failed to update order' });
  }
});

// Websocket events
io.on('connection', (socket) => {
  console.log('socket connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
