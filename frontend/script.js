let currentUser = null;

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  let res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    let data = await res.json();
    currentUser = data.username;
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("adminSection").classList.remove("hidden");
  } else {
    document.getElementById("loginMsg").innerText = "Login failed!";
  }
}

async function addPlayer() {
  let name = document.getElementById("playerName").value.trim();
  let deposit = parseInt(document.getElementById("playerDeposit").value) || 0;
  await fetch("/api/players", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, deposit })
  });
  alert("Player added!");
}

async function addSession() {
  let date = document.getElementById("sessionDate").value;
  let court = parseInt(document.getElementById("sessionCourt").value) || 0;
  let shuttle = parseInt(document.getElementById("sessionShuttle").value) || 0;
  let attendees = document.getElementById("sessionAttendees").value.split(",").map(s => s.trim());

  await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, court, shuttle, attendees })
  });
  alert("Session added!");
}

async function loadReport() {
  let res = await fetch("/api/report");
  let data = await res.json();

  let html = `<table border="1" cellpadding="5">
    <tr><th>Player</th><th>Balance</th></tr>`;
  for (let [player, balance] of Object.entries(data.balances)) {
    let cls = balance < 0 ? "negative" : "";
    html += `<tr><td>${player}</td><td class="${cls}">${balance.toFixed(2)}</td></tr>`;
  }
  html += `</table>`;
  document.getElementById("reportTable").innerHTML = html;
}
