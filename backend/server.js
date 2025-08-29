const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const db = new sqlite3.Database("./badminton.db");

app.use(cors());
app.use(bodyParser.json());
app.use(express.static("frontend")); // serve frontend

// --- Create tables if not exist ---
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    deposit INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    court INTEGER,
    shuttle INTEGER,
    attendees TEXT
  )`);
});

// --- Hardcoded admin login for now ---
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    res.json({ ok: true, username });
  } else {
    res.status(401).json({ ok: false, message: "Invalid username or password" });
  }
});

// --- Players ---
app.post("/api/players", (req, res) => {
  const { name, deposit } = req.body;
  db.run(`INSERT OR IGNORE INTO players (name, deposit) VALUES (?, ?)`, [name, deposit || 0], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, name, deposit: deposit || 0 });
  });
});

app.get("/api/players", (req, res) => {
  db.all(`SELECT * FROM players`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- Sessions ---
app.post("/api/sessions", (req, res) => {
  const { date, court, shuttle, attendees } = req.body;
  db.run(
    `INSERT INTO sessions (date, court, shuttle, attendees) VALUES (?, ?, ?, ?)`,
    [date, court, shuttle, attendees.join(",")],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, date, court, shuttle, attendees });
    }
  );
});

app.get("/api/sessions", (req, res) => {
  db.all(`SELECT * FROM sessions`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows.map(r => ({
      ...r,
      attendees: r.attendees ? r.attendees.split(",") : []
    })));
  });
});

// --- Reports ---
app.get("/api/report", (req, res) => {
  db.all(`SELECT * FROM players`, [], (err, players) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(`SELECT * FROM sessions`, [], (err2, sessions) => {
      if (err2) return res.status(500).json({ error: err2.message });

      let balances = {};
      players.forEach(p => balances[p.name] = p.deposit);

      sessions.forEach(s => {
        let attendees = s.attendees.split(",");
        let perHead = (s.court + s.shuttle) / attendees.length;
        attendees.forEach(a => {
          balances[a] = (balances[a] || 0) - perHead;
        });
      });

      res.json({ players, sessions, balances });
    });
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
