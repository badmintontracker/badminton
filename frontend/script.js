const API = '/api';

// ---- Elements ----
const loginSection = document.getElementById('loginSection');
const dashboard = document.getElementById('dashboard');
const reports = document.getElementById('reports');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');

const playersList = document.getElementById('playersList');
const playerForm = document.getElementById('playerForm');
const depositForm = document.getElementById('depositForm');
const depositPlayer = document.getElementById('depositPlayer');
const attendeesCheckboxes = document.getElementById('attendeesCheckboxes');
const sessionForm = document.getElementById('sessionForm');

const sessionsTable = document.getElementById('sessionsTable').querySelector('tbody');
const exportBtn = document.getElementById('exportBtn');

let loggedIn = false;

// ---- Login ----
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    loggedIn = true;
    loginSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadPlayers();
  } else {
    loginError.textContent = 'Invalid username/password';
  }
});

// ---- Logout ----
logoutBtn.addEventListener('click', () => {
  loggedIn = false;
  loginSection.classList.remove('hidden');
  dashboard.classList.add('hidden');
});

// ---- Players ----
async function loadPlayers() {
  const res = await fetch(`${API}/players`);
  const players = await res.json();

  playersList.innerHTML = players.map(p => `<li>${p.name} - Balance: ${p.balance}</li>`).join('');

  depositPlayer.innerHTML = players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');

  attendeesCheckboxes.innerHTML = players.map(p => `
    <label><input type="checkbox" value="${p.id}">${p.name}</label><br>
  `).join('');
}

playerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('playerName').value;
  await fetch(`${API}/players`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  playerForm.reset();
  loadPlayers();
});

// ---- Deposits ----
depositForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const player_id = depositPlayer.value;
  const amount = document.getElementById('depositAmount').value;
  await fetch(`${API}/deposits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id, amount })
  });
  depositForm.reset();
  loadPlayers();
});

// ---- Sessions ----
sessionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('sessionDate').value;
  const court_cost = document.getElementById('courtCost').value;
  const shuttle_cost = document.getElementById('shuttleCost').value;
  const attendees = Array.from(attendeesCheckboxes.querySelectorAll('input:checked')).map(cb => cb.value);

  await fetch(`${API}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, court_cost, shuttle_cost, attendees })
  });

  sessionForm.reset();
  loadSessions();
});

async function loadSessions() {
  const res = await fetch(`${API}/sessions`);
  const sessions = await res.json();

  sessionsTable.innerHTML = sessions.map(s => `
    <tr>
      <td>${s.date}</td>
      <td>${s.court_cost}</td>
      <td>${s.shuttle_cost}</td>
      <td>${s.attendees || ''}</td>
    </tr>
  `).join('');
}

// ---- Export ----
exportBtn.addEventListener('click', () => {
  window.location.href = `${API}/export`;
});

// ---- Initial ----
loadSessions();
