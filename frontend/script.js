async function loadSessions() {
  const res = await fetch("/api/sessions");
  const sessions = await res.json();

  const tbody = document.querySelector("#sessionsTable tbody");
  tbody.innerHTML = "";

  sessions.forEach(s => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${s.date}</td>
      <td>${s.court}</td>
      <td>${s.shuttle}</td>
      <td>${s.attendees.join(", ")}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function loadReport() {
  const res = await fetch("/api/report");
  const players = await res.json();

  const tbody = document.querySelector("#reportTable tbody");
  tbody.innerHTML = "";

  players.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${p.name}</td>
      <td>${p.deposit}</td>
      <td style="color:${p.balance < 0 ? 'red' : 'green'}">${p.balance.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

loadSessions();
loadReport();
