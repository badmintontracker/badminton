let isAdmin = false;

async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch("http://localhost:8080/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    isAdmin = true;
    document.getElementById("adminPanel").style.display = "block";
    document.getElementById("loginSection").style.display = "none";
  } else {
    document.getElementById("loginMsg").innerText = "Invalid login!";
  }
}

function logout() {
  isAdmin = false;
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("loginSection").style.display = "block";
}

// Load reports
async function loadReports() {
  // Sessions
  const sRes = await fetch("http://localhost:8080/api/sessions");
  const sessions = await sRes.json();
  const sTable = document.getElementById("sessionReport");
  sessions.forEach(s => {
    const row = sTable.insertRow();
    row.insertCell().innerText = s.date;
    row.insertCell().innerText = s.attendees.join(", ");
  });

  // Players
  const pRes = await fetch("http://localhost:8080/api/players/report");
  const players = await pRes.json();
  const pTable = document.getElementById("playerReport");
  for (const [name, info] of Object.entries(players)) {
    const row = pTable.insertRow();
    row.insertCell().innerText = name;
    row.insertCell().innerText = info.deposit;
    row.insertCell().innerText = info.sessions.join(", ");
  }
}

window.onload = loadReports;
