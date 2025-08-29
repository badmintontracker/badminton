async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    document.getElementById("login").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    loadPlayers();
  } else {
    document.getElementById("loginError").innerText = "Invalid credentials";
  }
}

async function loadPlayers() {
  const res = await fetch("/api/players");
  const players = await res.json();
  let html = "<h3>Players</h3><table><tr><th>Name</th><th>Deposit</th></tr>";
  players.forEach(p => {
    html += `<tr><td>${p.name}</td><td>${p.deposit}</td></tr>`;
  });
  html += "</table>";
  document.getElementById("content").innerHTML = html;
}

async function loadSessions() {
  const res = await fetch("/api/sessions");
  const sessions = await res.json();
  let html = "<h3>Sessions</h3><table><tr><th>Date</th><th>Court</th><th>Shuttle</th><th>Attendees</th><th>Share</th></tr>";
  sessions.forEach(s => {
    html += `<tr><td>${s.date}</td><td>${s.courtCost}</td><td>${s.shuttleCost}</td><td>${s.attendees}</td><td>${s.perShare.toFixed(2)}</td></tr>`;
  });
  html += "</table>";
  document.getElementById("content").innerHTML = html;
}

async function loadReport() {
  const res = await fetch("/api/reports");
  const report = await res.json();
  let html = "<h3>Player Report</h3><table><tr><th>Name</th><th>Deposit</th><th>Spent</th><th>Balance</th></tr>";
  report.forEach(r => {
    const balanceClass = r.balance < 0 ? "negative" : "";
    html += `<tr><td>${r.name}</td><td>${r.deposit}</td><td>${r.spent.toFixed(2)}</td><td class="${balanceClass}">${r.balance.toFixed(2)}</td></tr>`;
  });
  html += "</table>";
  document.getElementById("content").innerHTML = html;
  document.getElementById("reportContent").innerHTML = html; // public copy
}

// Auto-load report for non-admins
loadReport();
