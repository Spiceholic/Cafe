const socket = io();

async function checkSession() {
  try {
    const res = await fetch('/api/session');
    if (res.ok) {
      const user = await res.json();
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
  const res = await fetch('/api/orders');
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
    li.innerHTML = `#${o.id} [${o.status}] <strong>${o.items}</strong> (by ${o.createdBy}) `;
    if (o.status === 'pending') {
      const btn1 = document.createElement('button');
      btn1.textContent = 'Start';
      btn1.onclick = () => updateStatus(o.id, 'in progress');
      li.appendChild(btn1);
    }
    if (o.status === 'in progress') {
      const btn2 = document.createElement('button');
      btn2.textContent = 'Finish';
      btn2.onclick = () => updateStatus(o.id, 'finished');
      li.appendChild(btn2);
    }
    list.appendChild(li);
  });
}

async function updateStatus(id, status) {
  const res = await fetch(`/api/orders/${id}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  if (!res.ok) {
    alert('Failed to update status');
  }
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
        body: JSON.stringify({ name, role: 'kitchen' })
      });
      if (res.ok) {
        const user = await res.json();
        showAppPanel(user.user);
        fetchOrders();
      } else {
        alert('Login failed');
      }
    } catch (err) {
      alert('Login error');
    }
  });

  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
      showLoginPanel();
      document.getElementById('login-form').reset();
    } catch (err) {
      alert('Logout failed');
    }
  });

  socket.on('orderCreated', fetchOrders);
  socket.on('orderUpdated', fetchOrders);
});