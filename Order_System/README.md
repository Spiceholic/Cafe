# Cafe Ordering System

This simple web application provides two interfaces for a café:

- **Service client**: create new orders and view all current orders. Orders are sorted by the current user's name with their own orders shown first. Service users receive push notifications when their orders are finished.
- **Kitchen client**: view each order's contents and creator, update order status from *pending* → *in progress* → *finished*.

The server stores orders in a MySQL database and uses Socket.IO for real-time updates and "push" notifications.

## Prerequisites

- **Node.js** (v14 or higher)
- **MySQL 5.7+** (must be installed and running)

## Setup

### 1. Create MySQL Database and User

Start MySQL and run the following commands:

```sql
CREATE DATABASE cafe_orders;
CREATE USER 'cafe_user'@'localhost' IDENTIFIED BY 'cafe_password';
GRANT ALL PRIVILEGES ON cafe_orders.* TO 'cafe_user'@'localhost';
FLUSH PRIVILEGES;
```

> **Note:** You can use any username/password. Update your `.env` file accordingly (see step 2).

### 2. Configure Environment Variables

1. Copy the example config:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your MySQL credentials:
   ```
   DB_HOST=localhost
   DB_USER=cafe_user
   DB_PASSWORD=cafe_password
   DB_NAME=cafe_orders
   PORT=3000
   ```

### 3. Install Dependencies and Start

```bash
cd Order_System
npm install
npm start
```

Or during development (auto-restart on changes):
```bash
npm run dev
```

### 4. Open the Interfaces

- **Service interface:** `http://localhost:3000/service.html`
- **Kitchen interface:** `http://localhost:3000/kitchen.html`

Create orders from the service page. Kitchen staff can update statuses; service clients will be alerted when an order is finished.

## Notes

- The database schema is created automatically on first startup.
- Orders are persisted in MySQL; restarting the server preserves all data.
- For production use, implement authentication, HTTPS, and proper access controls.
