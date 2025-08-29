const API = "http://localhost:8080/api";

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const res = await fetch(API + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (data.ok) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("adminSection").style.display = "block";
    loadPlayers();
  } else {
    document.getElementById("loginMsg").innerText = "Invalid login";
  }
}

async function loadPlayers() {
  const res = await fetch(API + "/players");
  const players = await res.json();
  const select = document.getElementById("depositPlayer");
  const attendeesDiv = document.getElementById("attendeesList");
  select.innerHTML = "";
  attendeesDiv.innerHTML = "";
  players.forEach((p) => {
    let opt = document.createElement("option");
    opt.value = p.id;
    opt.innerText = p.name;
    select.appendChild(opt);

    let cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = p.id;
    cb.id = "att_" + p.id;
    attendeesDiv.appendChild(cb);
    attendeesDiv.appendChild(document.createTextNode(p.name));
    attendeesDiv.appendChild(document.createElement("br"));
  });
}

async function addPlayer() {
  const name = document.getElementById("playerName").value;
  await fetch(API + "/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  loadPlayers();
}

async function addDeposit() {
  const playerId = document.getElementById("depositPlayer").value;
  const amount = document.getElementById("depositAmount").value;
  const date = new Date().toISOString().split("T")[0];
  await fetch(API + "/deposits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ playerId, amount: parseInt(amount), date }),
  });
}

async function addSession() {
  const date = document.getElementById("sessionDate").value;
  const court = parseInt(document.getElementById("courtCost").value);
  const shuttle = parseInt(document.getElementById("shuttleCost").value);
  const attendees = Array.from(document.querySelectorAll("#attendeesList input:checked")).map((cb) => parseInt(cb.value));
  await fetch(API + "/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, court, shuttle, attendees }),
  });
}

// Reports
async function loadSessions() {
  const res = await fetch(API + "/sessions");
  const sessions = await res.json();
  let html = "<h3>Sessions</h3><table border=1><tr><th>Date</th><th>Court</th><th>Shuttle</th><th>Attendees</th><th>Per Player Share</th></tr>";
  sessions.forEach((s) => {
    html += `<tr>
      <td>${s.date}</td><td>${s.court}</td><td>${s.shuttle}</td>
      <td>${s.attendees.join(", ")}</td>
      <td>${s.perShare.toFixed(2)}</td>
    </tr>`;
  });
  html += "</table>";
  document.getElementById("sessionsTable").innerHTML = html;
}

async function loadPlayerReport() {
  const res = await fetch(API + "/player-report");
  const players = await res.json();
  let html = "<h3>Player Report</h3><table border=1><tr><th>Name</th><th>Total Deposits</th><th>Total Spent</th><th>Balance</th></tr>";
  players.forEach((p) => {
    html += `<tr><td>${p.name}</td><td>${p.totalDeposits}</td><td>${p.totalSpent.toFixed(2)}</td><td>${p.balance.toFixed(2)}</td></tr>`;
  });
  html += "</table>";
  document.getElementById("playerReport").innerHTML = html;
}
