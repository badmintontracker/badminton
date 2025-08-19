/* frontend/script.js */
const API = ""; // relative to same origin

// Elements
const playersTableBody = document.querySelector('#playersTable tbody');
const courtCostEl = document.getElementById('courtCost');
const shuttleCostEl = document.getElementById('shuttleCost');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const exportExcelBtn = document.getElementById('exportExcelBtn');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const newPlayerNameEl = document.getElementById('newPlayerName');
const newPlayerDepositEl = document.getElementById('newPlayerDeposit');

const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeModalBtn = document.getElementById('closeModalBtn');

function openModal(title, html) {
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modalBackdrop.style.display = 'flex';
}
function closeModal() {
  modalBackdrop.style.display = 'none';
  modalTitle.textContent = '';
  modalBody.innerHTML = '';
}
closeModalBtn.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

// -------- API helpers --------
async function apiGet(url) {
  const res = await fetch(API + url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiSend(url, method, body) {
  const res = await fetch(API + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// -------- UI Renders --------
async function loadSettings() {
  const s = await apiGet('/api/settings');
  courtCostEl.value = Number(s.court_cost ?? 400);
  shuttleCostEl.value = Number(s.shuttle_cost ?? 100);
}

async function loadPlayers() {
  const players = await apiGet('/api/players');
  renderPlayers(players);
}

function money(n) {
  if (n == null) return '₹0';
  const v = Math.round(Number(n) * 100) / 100;
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function renderPlayers(players) {
  playersTableBody.innerHTML = '';
  players.forEach((p, idx) => {
    const tr = document.createElement('tr');

    const actionsHtml = `
      <div class="flex">
        <button class="secondary" data-action="deposit" data-id="${p.id}">Add Deposit</button>
        <button class="secondary" data-action="session" data-id="${p.id}">Add Session</button>
        <button class="secondary" data-action="manage" data-id="${p.id}">View/Edit</button>
      </div>
    `;

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="mono">${escapeHtml(p.name)}</span></td>
      <td class="right">${money(p.total_deposits)}</td>
      <td class="right"><span class="pill">${p.session_count}</span></td>
      <td class="right">${money(p.total_charges)}</td>
      <td class="right" style="font-weight:600; ${p.balance < 0 ? 'color:#f87171' : 'color:#34d399'}">${money(p.balance)}</td>
      <td>${actionsHtml}</td>
    `;
    playersTableBody.appendChild(tr);
  });

  // action listeners
  playersTableBody.querySelectorAll('button[data-action="deposit"]').forEach(btn => {
    btn.addEventListener('click', () => openDepositModal(Number(btn.dataset.id)));
  });
  playersTableBody.querySelectorAll('button[data-action="session"]').forEach(btn => {
    btn.addEventListener('click', () => openSessionModal(Number(btn.dataset.id)));
  });
  playersTableBody.querySelectorAll('button[data-action="manage"]').forEach(btn => {
    btn.addEventListener('click', () => openManageModal(Number(btn.dataset.id)));
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[s]));
}

// -------- Modals --------
async function openDepositModal(playerId) {
  const p = await getPlayer(playerId);
  openModal(`Add Deposit — ${p.name}`, `
    <div class="grid">
      <label>Amount (₹)
        <input id="depAmount" type="number" step="1" min="0" />
      </label>
      <label>Date
        <input id="depDate" type="datetime-local" />
      </label>
      <div class="col-span-2 flex" style="justify-content:flex-end; margin-top:8px;">
        <button id="saveDepositBtn">Save</button>
      </div>
    </div>
  `);
  document.getElementById('saveDepositBtn').addEventListener('click', async () => {
    const amt = Number(document.getElementById('depAmount').value || 0);
    const date = document.getElementById('depDate').value;
    if (amt <= 0) return alert('Enter amount > 0');
    await apiSend('/api/deposits', 'POST', { playerId, amount: amt, date: date || undefined });
    closeModal();
    await loadPlayers();
  });
}

async function openSessionModal(playerId) {
  const p = await getPlayer(playerId);
  const defaults = await apiGet('/api/settings');
  openModal(`Add Session — ${p.name}`, `
    <div class="grid">
      <label>Attendees (players who split cost)
        <input id="sessAtt" type="number" min="1" step="1" value="4" />
      </label>
      <label>Court Cost (₹)
        <input id="sessCourt" type="number" min="0" step="1" value="${Number(defaults.court_cost||400)}" />
      </label>
      <label>Shuttle Cost (₹)
        <input id="sessShuttle" type="number" min="0" step="1" value="${Number(defaults.shuttle_cost||100)}" />
      </label>
      <label>Date
        <input id="sessDate" type="datetime-local" />
      </label>
      <div class="col-span-2 muted">Charge to this player will be (Court + Shuttle) / Attendees.</div>
      <div class="col-span-2 flex" style="justify-content:flex-end; margin-top:8px;">
        <button id="saveSessionBtn">Save</button>
      </div>
    </div>
  `);
  document.getElementById('saveSessionBtn').addEventListener('click', async () => {
    const attendees = Number(document.getElementById('sessAtt').value || 0);
    const courtCost = Number(document.getElementById('sessCourt').value || 0);
    const shuttleCost = Number(document.getElementById('sessShuttle').value || 0);
    const date = document.getElementById('sessDate').value;
    if (attendees <= 0) return alert('Attendees must be > 0');
    await apiSend('/api/sessions', 'POST', { playerId, attendees, courtCost, shuttleCost, date: date || undefined });
    closeModal();
    await loadPlayers();
  });
}

async function openManageModal(playerId) {
  const p = await getPlayer(playerId);
  const hist = await apiGet(`/api/players/${playerId}/history`);
  openModal(`View / Edit — ${p.name}`, `
    <div class="grid">
      <div class="col-span-2">
        <label>Rename Player</label>
        <div class="flex">
          <input id="renamePlayer" value="${escapeHtml(p.name)}" class="grow" />
          <button id="saveRenameBtn" class="secondary">Save</button>
        </div>
      </div>

      <div class="col-span-2"><h4>Deposits</h4></div>
      <div class="col-span-2">
        <table style="width:100%">
          <thead><tr><th>ID</th><th>Amount</th><th>Date</th><th>Action</th></tr></thead>
          <tbody id="depRows">
            ${hist.deposits.map(d => `
              <tr>
                <td class="mono">${d.id}</td>
                <td>${money(d.amount)}</td>
                <td>${fmtDate(d.date)}</td>
                <td><button data-del-dep="${d.id}" class="danger">Delete</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="col-span-2"><h4>Sessions</h4></div>
      <div class="col-span-2">
        <table style="width:100%">
          <thead><tr><th>ID</th><th>Attendees</th><th>Court</th><th>Shuttle</th><th>Charge</th><th>Date</th><th>Action</th></tr></thead>
        <tbody id="sessRows">
          ${hist.sessions.map(s => `
            <tr>
              <td class="mono">${s.id}</td>
              <td>${s.attendees}</td>
              <td>${money(s.court_cost)}</td>
              <td>${money(s.shuttle_cost)}</td>
              <td>${money(s.charge)}</td>
              <td>${fmtDate(s.date)}</td>
              <td><button data-del-sess="${s.id}" class="danger">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
        </table>
      </div>
    </div>
  `);

  document.getElementById('saveRenameBtn').addEventListener('click', async () => {
    const newName = document.getElementById('renamePlayer').value.trim();
    if (!newName) return alert('Name required');
    await apiSend(`/api/players/${playerId}`, 'PUT', { name: newName });
    await loadPlayers();
    closeModal();
  });

  // delete handlers
  modalBody.querySelectorAll('button[data-del-dep]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this deposit?')) return;
      await apiSend(`/api/deposits/${btn.dataset.delDep}`, 'DELETE');
      openManageModal(playerId); // reload
      await loadPlayers();
    });
  });
  modalBody.querySelectorAll('button[data-del-sess]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this session?')) return;
      await apiSend(`/api/sessions/${btn.dataset.delSess}`, 'DELETE');
      openManageModal(playerId); // reload
      await loadPlayers();
    });
  });
}

async function getPlayer(id) {
  const all = await apiGet('/api/players');
  const found = all.find(p => p.id === id);
  if (!found) throw new Error('Player not found');
  return found;
}

function fmtDate(d) {
  try {
    // d may be "YYYY-MM-DD HH:MM:SS"
    const iso = d && d.includes(' ') ? d.replace(' ', 'T') : d;
    const date = iso ? new Date(iso) : new Date();
    return date.toLocaleString();
  } catch {
    return d || '';
  }
}

// -------- Buttons --------
saveSettingsBtn.addEventListener('click', async () => {
  const court_cost = Number(courtCostEl.value || 0);
  const shuttle_cost = Number(shuttleCostEl.value || 0);
  await apiSend('/api/settings', 'PUT', { court_cost, shuttle_cost });
  alert('Defaults saved.');
});

addPlayerBtn.addEventListener('click', async () => {
  const name = newPlayerNameEl.value.trim();
  const initialDeposit = Number(newPlayerDepositEl.value || 0);
  if (!name) return alert('Enter player name');
  await apiSend('/api/players', 'POST', { name, initialDeposit: initialDeposit > 0 ? initialDeposit : 0 });
  newPlayerNameEl.value = '';
  newPlayerDepositEl.value = '';
  await loadPlayers();
});

exportExcelBtn.addEventListener('click', async () => {
  const { players, deposits, sessions, settings } = await apiGet('/api/export-data');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Badminton Tracker';
  const summary = wb.addWorksheet('Summary');
  const tx = wb.addWorksheet('Transactions');

  // Summary
  summary.addRow(['#', 'Player', 'Deposits', 'Sessions', 'Charges', 'Balance']);
  players.forEach((p, i) => {
    summary.addRow([
      i + 1,
      p.name,
      Number(p.total_deposits || 0),
      Number(p.session_count || 0),
      Number(p.total_charges || 0),
      Number(p.balance || 0)
    ]);
  });
  summary.getRow(1).font = { bold: true };

  // Transactions
  tx.addRow(['Type', 'ID', 'Player', 'Amount/Charge', 'Attendees', 'Court', 'Shuttle', 'Date']);
  deposits.forEach(d => {
    tx.addRow(['DEPOSIT', d.id, d.player_name, Number(d.amount), '', '', '', d.date]);
  });
  sessions.forEach(s => {
    tx.addRow(['SESSION', s.id, s.player_name, Number(s.charge), s.attendees, Number(s.court_cost), Number(s.shuttle_cost), s.date]);
  });
  tx.getRow(1).font = { bold: true };

  // Autosize columns
  [summary, tx].forEach(ws => {
    ws.columns.forEach(col => {
      let max = 10;
      col.eachCell({ includeEmpty: true }, c => {
        const v = String(c.value ?? '');
        if (v.length > max) max = v.length;
      });
      col.width = Math.min(40, Math.max(10, max + 2));
    });
  });

  // A small note sheet
  const notes = wb.addWorksheet('Notes');
  const court = settings.find(s => s.key === 'court_cost')?.value ?? '400';
  const shuttle = settings.find(s => s.key === 'shuttle_cost')?.value ?? '100';
  notes.addRow(['Defaults']);
  notes.addRow(['Court Cost', court]);
  notes.addRow(['Shuttle Cost', shuttle]);

  const buf = await wb.xlsx.writeBuffer();
  const today = new Date();
  const filename = `badminton-report-${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}.xlsx`;
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
});

// -------- Init --------
(async function init() {
  await loadSettings();
  await loadPlayers();
})();
