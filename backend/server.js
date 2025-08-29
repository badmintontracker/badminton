const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const db = new sqlite3.Database("./badminton.db");

// Initialize DB tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    deposit INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    player_id INTEGER,
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (player_id) REFERENCES players(id)
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

// --- GET SESSIONS + ATTENDEES ---
app.get("/api/sessions", (req, res) => {
  const sql = `
    SELECT s.id as session_id, s.date, p.name
    FROM sessions s
    LEFT JOIN session_attendees sa ON s.id = sa.session_id
    LEFT JOIN players p ON sa.player_id = p.id
    ORDER BY s.date DESC, p.name
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const sessions = {};
    rows.forEach(r => {
      if (!sessions[r.session_id]) {
        sessions[r.session_id] = { date: r.date, attendees: [] };
      }
      if (r.name) sessions[r.session_id].attendees.push(r.name);
    });

    res.json(Object.values(sessions));
  });
});

// --- GET PLAYER REPORT ---
app.get("/api/players/report", (req, res) => {
  const sql = `
    SELECT p.id, p.name, p.deposit, s.date
    FROM players p
    LEFT JOIN session_attendees sa ON p.id = sa.player_id
    LEFT JOIN sessions s ON sa.session_id = s.id
    ORDER BY p.name, s.date
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const report = {};
    rows.forEach(r => {
      if (!report[r.name]) {
        report[r.name] = { deposit: r.deposit || 0, sessions: [] };
      }
      if (r.date) report[r.name].sessions.push(r.date);
    });

    res.json(report);
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
