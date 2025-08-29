const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// DB setup
const db = new sqlite3.Database("./badminton.db");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    deposit INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    courtCost INTEGER,
    shuttleCost INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session_attendees (
    session_id INTEGER,
    player_id INTEGER,
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);
});

// --- LOGIN ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    res.json({ ok: true, username });
  } else {
    res.status(401).json({ ok: false, message: "Invalid credentials" });
  }
});

// --- ADD PLAYER ---
app.post("/api/players", (req, res) => {
  const { name, deposit } = req.body;
  db.run("INSERT INTO players (name, deposit) VALUES (?, ?)", [name, deposit || 0], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, name, deposit });
  });
});

// --- GET PLAYERS ---
app.get("/api/players", (req, res) => {
  db.all("SELECT * FROM players", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- ADD SESSION ---
app.post("/api/sessions", (req, res) => {
  const { date, courtCost, shuttleCost, attendees } = req.body;
  db.run("INSERT INTO sessions (date, courtCost, shuttleCost) VALUES (?, ?, ?)",
    [date, courtCost, shuttleCost],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      const sessionId = this.lastID;
      attendees.forEach(playerId => {
        db.run("INSERT INTO session_attendees (session_id, player_id) VALUES (?, ?)", [sessionId, playerId]);
      });
      res.json({ id: sessionId, date, courtCost, shuttleCost, attendees });
    });
});

// --- GET SESSIONS + Attendees ---
app.get("/api/sessions", (req, res) => {
  const query = `
    SELECT s.id, s.date, s.courtCost, s.shuttleCost, group_concat(p.name) as attendees
    FROM sessions s
    LEFT JOIN session_attendees sa ON s.id = sa.session_id
    LEFT JOIN players p ON sa.player_id = p.id
    GROUP BY s.id
    ORDER BY s.date DESC
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(row => {
      const names = row.attendees ? row.attendees.split(",") : [];
      const totalCost = row.courtCost + row.shuttleCost;
      const perShare = names.length > 0 ? (totalCost / names.length) : 0;
      row.perShare = perShare;
      row.attendeesList = names;
    });
    res.json(rows);
  });
});

// --- REPORT (public) ---
app.get("/api/reports", (req, res) => {
  const query = `
    SELECT p.id, p.name, p.deposit,
      IFNULL(SUM((s.courtCost + s.shuttleCost) * 1.0 / (
        SELECT COUNT(*) FROM session_attendees sa2 WHERE sa2.session_id = s.id
      )), 0) as spent
    FROM players p
    LEFT JOIN session_attendees sa ON p.id = sa.player_id
    LEFT JOIN sessions s ON sa.session_id = s.id
    GROUP BY p.id
  `;
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const report = rows.map(r => ({
      name: r.name,
      deposit: r.deposit,
      spent: r.spent,
      balance: r.deposit - r.spent
    }));
    res.json(report);
  });
});

// Fallback: send index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
