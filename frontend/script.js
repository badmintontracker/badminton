const API = ""; // relative paths work inside Docker

// ---------------------- Players ----------------------
async function addPlayer() {
  const name = document.getElementById('playerName').value.trim();
  const deposit = parseFloat(document.getElementById('playerDeposit').value) || 0;
  if (!name) { alert("Enter player name"); return; }

  await fetch(`${API}/players`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({name, deposit})
  });

  document.getElementById('playerName').value = '';
  document.getElementById('playerDeposit').value = '';
  loadPlayers();
}

async function loadPlayers() {
  const res = await fetch(`${API}/players`);
  const data = await res.json();

  // Players Table
  document.getElementById("playersTable").innerHTML =
    "<tr><th>Name</th><th>Deposit</th></tr>" +
    data.map(p => `<tr><td>${p.name}</td><td>${p.deposit}</td></tr>`).join("");

  // Session multi-select
  document.getElementById("sessionPlayers").innerHTML =
    data.map(p => `<option value="${p.id}">${p.name}</option>`).join("");
}

// ---------------------- Multi-Player Session ----------------------
async function addSession() {
  const playerSelect = document.getElementById("sessionPlayers");
  const selectedPlayers = Array.from(playerSelect.selectedOptions).map(opt => parseInt(opt.value));
  const courtCost = parseFloat(document.getElementById("sessionCourtCost").value) || 0;
  const shuttleCost = parseFloat(document.getElementById("sessionShuttleCost").value) || 0;
  const date = document.getElementById("sessionDate").value;

  if (selectedPlayers.length === 0) { alert("Select players"); return; }
  if (!date) { alert("Select date"); return; }

  const totalCost = courtCost + shuttleCost;
  const perPlayerCost = totalCost / selectedPlayers.length;

  // Add attendance for each selected player
  for (const pid of selectedPlayers) {
    await fetch(`${API}/attendance`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({player_id: pid, date})
    });
  }

  // Record total expense for that date
  if (totalCost > 0) {
    await fetch(`${API}/expenses`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({type:"session", amount: totalCost, date})
    });
  }

  // Clear input fields
  document.getElementById("sessionCourtCost").value = '';
  document.getElementById("sessionShuttleCost").value = '';
  document.getElementById("sessionDate").value = '';
  playerSelect.selectedIndex = -1;

  loadReport();
  loadPlayers();
}

// ---------------------- Reports ----------------------
async function loadReport() {
  const res = await fetch(`${API}/report`);
  const data = await res.json();

  // Daily Report
  let reportHtml = "";
  data.dailyReports.forEach(day => {
    reportHtml += `
      <div class="card p-3 mb-3">
        <h5>${day.date}</h5>
        <b>Expenses:</b>
        <ul>${day.expenses.map(e=>`<li>${e.type}: ${e.amount}</li>`).join("")}</ul>
        <b>Attendees:</b> ${day.attendees.join(", ") || "None"}<br>
        <b>Per Head:</b> ${day.perHead.toFixed(2)}
      </div>`;
  });
  document.getElementById("dailyReport").innerHTML = reportHtml;

  // Final Balances
  document.getElementById("balanceTable").innerHTML =
    `<tr><th>Name</th><th>Deposit</th><th>Balance</th></tr>` +
    data.balances.map(b =>
      `<tr>
        <td>${b.name}</td>
        <td>${b.deposit}</td>
        <td style="color:${b.balance < 0 ? 'red':'green'}">${b.balance.toFixed(2)}</td>
      </tr>`
    ).join("");
}

// ---------------------- Initial Load ----------------------
loadPlayers();
loadReport();
