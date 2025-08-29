async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  let res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("adminSection").style.display = "block";
  } else {
    document.getElementById("loginMsg").innerText = "Invalid login!";
  }
}

async function addDeposit() {
  const player = document.getElementById("depositPlayer").value;
  const amount = parseInt(document.getElementById("depositAmount").value);
  const date = document.getElementById("depositDate").value;

  await fetch("/api/deposits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player, amount, date })
  });
  loadReports();
}

async function addSession() {
  const date = document.getElementById("sessionDate").value;
  const court = parseInt(document.getElementById("sessionCourt").value);
  const shuttle = parseInt(document.getElementById("sessionShuttle").value);
  const attendees = document.getElementById("sessionAttendees").value.split(",").map(s => s.trim());

  await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, court, shuttle, attendees })
  });
  loadReports();
}

async function loadReports() {
  let res = await fetch("/api/reports");
  let data = await res.json();

  // Balances
  let balancesHTML = "<h3>Balances</h3><table border='1'><tr><th>Player</th><th>Balance</th></tr>";
  for (let player in data.players) {
    balancesHTML += `<tr><td>${player}</td><td>${data.players[player].balance.toFixed(2)}</td></tr>`;
  }
  balancesHTML += "</table>";
  document.getElementById("balances").innerHTML = balancesHTML;

  // Player histories
  let historiesHTML = "<h3>Player Histories</h3>";
  for (let player in data.players) {
    historiesHTML += `<h4>${player}</h4><ul>`;
    data.players[player].deposits.forEach(d => {
      historiesHTML += `<li>Deposit: +${d.amount} (${d.date})</li>`;
    });
    data.players[player].sessions.forEach(s => {
      historiesHTML += `<li>Session: -${s.share.toFixed(2)} (Court ${s.court}, Shuttle ${s.shuttle}, Date ${s.date})</li>`;
    });
    historiesHTML += `</ul><b>Balance: ${data.players[player].balance.toFixed(2)}</b>`;
  }
  document.getElementById("playerHistories").innerHTML = historiesHTML;

  // Sessions
  let sessionsHTML = "<h3>Sessions</h3><table border='1'><tr><th>Date</th><th>Court</th><th>Shuttle</th><th>Attendees</th><th>Per Share</th></tr>";
  data.sessions.forEach(s => {
    sessionsHTML += `<tr><td>${s.date}</td><td>${s.court}</td><td>${s.shuttle}</td><td>${s.attendees.join(", ")}</td><td>${s.perShare.toFixed(2)}</td></tr>`;
  });
  sessionsHTML += "</table>";
  document.getElementById("sessions").innerHTML = sessionsHTML;
}
