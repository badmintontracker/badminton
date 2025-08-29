async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const data = await res.json();
  if (data.ok) {
    document.getElementById("loginStatus").innerText = "✅ Login successful";
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("app").style.display = "block";
    loadPlayers();
    loadSessions();
  } else {
    document.getElementById("loginStatus").innerText = "❌ Login failed";
  }
}

async function addPlayer() {
  const name = document.getElementById("playerName").value.trim();
  const deposit = parseInt(document.getElementById("playerDeposit").value) || 0;
  if (!name) return alert("Enter player name");

  const res = await fetch("/api/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, deposit }),
  });

  const data = await res.json();
  if (data.error) alert("Error: " + data.error);
  else loadPlayers();
}

async function loadPlayers() {
  const res = await fetch("/api/players");
  const players = await res.json();

  const list = document.getElementById("playersList");
  list.innerHTML = "";
  players.forEach((p) => {
    const li = document.createElement("li");
    li.innerText = `${p.name} (Deposit: ₹${p.deposit})`;
    list.appendChild(li);
  });
}

async function loadSessions() {
  const res = await fetch("/api/sessions");
  const sessions = await res.json();

  const table = document.getElementById("sessionsTable");
  table.innerHTML = "<tr><th>Date</th><th>Court</th><th>Shuttle</th><th>Attendees</th><th>Share</th></tr>";

  sessions.forEach((s) => {
    const row = table.insertRow();
    row.insertCell().innerText = s.date;
    row.insertCell().innerText = s.court;
    row.insertCell().innerText = s.shuttle;
    row.insertCell().innerText = s.attendees.join(", ");
    const share = (s.court + s.shuttle) / s.attendees.length;
    row.insertCell().innerText = "₹" + share.toFixed(2);
  });
}

async function loadReport() {
  const res = await fetch("/api/reports/player-wise");
  const report = await res.json();

  const table = document.getElementById("reportTable");
  table.innerHTML = "<tr><th>Player</th><th>Deposit</th><th>Spent</th><th>Balance</th></tr>";

  report.forEach((r) => {
    const row = table.insertRow();
    row.insertCell().innerText = r.name;
    row.insertCell().innerText = "₹" + r.deposit;
    row.insertCell().innerText = "₹" + r.spent;
    const balCell = row.insertCell();
    balCell.innerText = "₹" + r.balance;
    if (parseFloat(r.balance) < 0) {
      balCell.style.color = "red"; // highlight negative balances
      balCell.style.fontWeight = "bold";
    }
  });
}
