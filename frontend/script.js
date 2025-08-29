const API = "http://localhost:8080/api"; // adjust if deployed

function showSection(id) {
  document.querySelectorAll(".section").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
}

// Login
async function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  const res = await fetch(`${API}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    document.getElementById("loginStatus").innerText = "Login successful";
    showSection("sessions");
    loadSessions();
  } else {
    document.getElementById("loginStatus").innerText = "Invalid credentials";
  }
}

// Add session
document.getElementById("sessionForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = document.getElementById("date").value;
  const court = parseInt(document.getElementById("court").value);
  const shuttle = parseInt(document.getElementById("shuttle").value);
  const attendees = document.getElementById("attendees").value.split(",").map(s => s.trim());

  await fetch(`${API}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, court, shuttle, attendees })
  });

  loadSessions();
});

// Load sessions
async function loadSessions() {
  const res = await fetch(`${API}/sessions`);
  const data = await res.json();
  const tbody = document.querySelector("#sessionsTable tbody");
  tbody.innerHTML = "";

  data.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${s.date}</td><td>${s.court}</td><td>${s.shuttle}</td><td>${s.attendees.join(", ")}</td><td>${s.share.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });
}

// Load reports
async function loadReports() {
  const res = await fetch(`${API}/reports`);
  const data = await res.json();

  // Player balances
  const tbody = document.querySelector("#playersTable tbody");
  tbody.innerHTML = "";
  data.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.name}</td><td>${p.deposit}</td><td>${p.spent.toFixed(2)}</td><td>${p.balance.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });

  // Player-wise details
  const detailsDiv = document.getElementById("playerDetails");
  detailsDiv.innerHTML = "";
  data.forEach(p => {
    const div = document.createElement("div");
    div.innerHTML = `<h5>${p.name}</h5>`;
    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>Date</th><th>Court</th><th>Shuttle</th><th>Share</th></tr></thead>`;
    const tb = document.createElement("tbody");
    p.sessions.forEach(s => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${s.date}</td><td>${s.court}</td><td>${s.shuttle}</td><td>${s.share.toFixed(2)}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    div.appendChild(table);
    detailsDiv.appendChild(div);
  });
}

document.querySelector("button[onclick=\"showSection('reports')\"]").addEventListener("click", loadReports);
