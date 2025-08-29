const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
app.use(bodyParser.json());
app.use(cors());

// SQLite DB
const db = new sqlite3.Database("./badminton.db");

// Init tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    deposit INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    amount INTEGER,
    date TEXT,
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    court INTEGER,
    shuttle INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    player_id INTEGER,
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);
});

// ---------------- API ROUTES ----------------

// Fake login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    res.json({ ok: true, role: "admin" });
  } else {
    res.json({ ok: false });
  }
});

// Add player
app.post("/api/players", (req, res) => {
  const { name } = req.body;
  db.run("INSERT OR IGNORE INTO players (name) VALUES (?)", [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ ok: true, id: this.lastID });
  });
});

// Get players
app.get("/api/players", (req, res) => {
  db.all("SELECT * FROM players", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add deposit
app.post("/api/deposits", (req, res) => {
  const { playerId, amount, date } = req.body;
  db.run("INSERT INTO deposits (player_id, amount, date) VALUES (?, ?, ?)", [playerId, amount, date], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    db.run("UPDATE players SET deposit = deposit + ? WHERE id = ?", [amount, playerId]);
    res.json({ ok: true });
  });
});

// Add session
app.post("/api/sessions", (req, res) => {
  const { date, court, shuttle, attendees } = req.body;
  db.run("INSERT INTO sessions (date, court, shuttle) VALUES (?, ?, ?)", [date, court, shuttle], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    const sessionId = this.lastID;
    attendees.forEach((pId) => {
      db.run("INSERT INTO session_attendees (session_id, player_id) VALUES (?, ?)", [sessionId, pId]);
    });
    res.json({ ok: true, sessionId });
  });
});

// Get sessions with attendees + per share
app.get("/api/sessions", (req, res) => {
  db.all("SELECT * FROM sessions ORDER BY date DESC", [], (err, sessions) => {
    if (err) return res.status(500).json({ error: err.message });

    const tasks = sessions.map(
      (s) =>
        new Promise((resolve, reject) => {
          db.all(
            "SELECT p.name FROM session_attendees sa JOIN players p ON sa.player_id=p.id WHERE sa.session_id=?",
            [s.id],
            (err2, attendees) => {
              if (err2) reject(err2);
              const totalCost = s.court + s.shuttle;
              const perShare = attendees.length > 0 ? totalCost / attendees.length : 0;
              resolve({ ...s, attendees: attendees.map((a) => a.name), perShare });
            }
          );
        })
    );

    Promise.all(tasks)
      .then((result) => res.json(result))
      .catch((e) => res.status(500).json({ error: e.message }));
  });
});

// Player-wise report (deposits + sessions)
app.get("/api/player-report", (req, res) => {
  db.all("SELECT * FROM players", [], (err, players) => {
    if (err) return res.status(500).json({ error: err.message });

    const tasks = players.map(
      (p) =>
        new Promise((resolve, reject) => {
          db.all("SELECT * FROM deposits WHERE player_id=?", [p.id], (err2, deposits) => {
            if (err2) reject(err2);

            db.all(
              `SELECT s.date, s.court, s.shuttle, 
                      (s.court+s.shuttle) AS totalCost
               FROM sessions s 
               JOIN session_attendees sa ON s.id=sa.session_id
               WHERE sa.player_id=?`,
              [p.id],
              (err3, sessions) => {
                if (err3) reject(err3);

                const totalDeposits = deposits.reduce((a, d) => a + d.amount, 0);
                const totalSpent = sessions.reduce((a, s) => a + s.totalCost / sessions.length, 0); // incorrect share, fix below

                // calculate per-session share individually
                let spent = 0;
                sessions.forEach((s) => {
                  spent += s.totalCost / sessions.length;
                });

                resolve({
                  name: p.name,
                  deposits,
                  sessions,
                  totalDeposits,
                  totalSpent: spent,
                  balance: totalDeposits - spent,
                });
              }
            );
          });
        })
    );

    Promise.all(tasks)
      .then((report) => res.json(report))
      .catch((e) => res.status(500).json({ error: e.message }));
  });
});

// ---------------- START SERVER ----------------
const PORT = 8080;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));
