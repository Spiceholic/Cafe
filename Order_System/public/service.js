const socket = io();
let currentUser = '';

async function checkSession() {
  try {
    const res = await fetch('/api/session');
    if (res.ok) {
      const user = await res.json();
      currentUser = user.name;
      showAppPanel(user);
      fetchOrders();
    } else {
      showLoginPanel();
    }
  } catch (err) {
    showLoginPanel();
  }
}

function showLoginPanel() {
  document.getElementById('login-panel').style.display = 'block';
  document.getElementById('app-panel').style.display = 'none';
}

function showAppPanel(user) {
  document.getElementById('login-panel').style.display = 'none';
  document.getElementById('app-panel').style.display = 'block';
  document.getElementById('user-display').textContent = `Logged in as: ${user.name}`;
}

async function fetchOrders() {
  const res = await fetch(`/api/orders?owner=${encodeURIComponent(currentUser)}`);
  if (!res.ok) {
    console.error('Failed to fetch orders');
    return;
  }
  const orders = await res.json();
  renderOrders(orders);
}

function renderOrders(orders) {
  const list = document.getElementById('orders-list');
  list.innerHTML = '';
  orders.forEach(o => {
    const li = document.createElement('li');
    li.textContent = `#${o.id} [${o.status}] ${o.items} (by ${o.createdBy})`;
    list.appendChild(li);
  });
}

window.addEventListener('load', () => {
  checkSession();

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    if (!name) return;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, role: 'service' })
      });
      if (res.ok) {
        const user = await res.json();
        currentUser = name;
        showAppPanel(user.user);
        fetchOrders();
      }
    } catch (err) {
      alert('Login failed');
    }
  });

  document.getElementById('new-order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemsInput = document.getElementById('items');
    const items = itemsInput.value.trim();
    if (!items) return;
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      if (res.ok) {
        itemsInput.value = '';
        fetchOrders();
      }
    } catch (err) {
      alert('Failed to create order');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      currentUser = '';
      showLoginPanel();
      document.getElementById('login-form').reset();
    } catch (err) {
      alert('Logout failed');
    }
  });

  socket.on('orderCreated', order => {
    fetchOrders();
  });

  socket.on('orderUpdated', order => {
    // notify user if their order finished
    if (order.createdBy === currentUser && order.status === 'finished') {
      alert(`Order #${order.id} is ready for pickup!`);
    }
    fetchOrders();
  });
});
