const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// SQLite setup
const db = new sqlite3.Database("./badminton.db", (err) => {
  if (err) console.error("DB error:", err.message);
  else console.log("Connected to SQLite");
});

// Tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    deposit INTEGER DEFAULT 0
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

// ----------- AUTH ----------
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  db.get(
    "SELECT * FROM users WHERE username=? AND password=?",
    [username, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (row) res.json({ ok: true, username: row.username });
      else res.status(401).json({ ok: false, error: "Invalid credentials" });
    }
  );
});

// ----------- PLAYERS ----------
app.post("/api/players", (req, res) => {
  const { name, deposit } = req.body;
  db.run(
    "INSERT INTO players (name, deposit) VALUES (?, COALESCE(?,0))",
    [name, deposit],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: this.lastID, name, deposit });
    }
  );
});

app.get("/api/players", (req, res) => {
  db.all("SELECT * FROM players", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ----------- SESSIONS ----------
app.post("/api/sessions", (req, res) => {
  const { date, court, shuttle, attendees } = req.body;
  db.run(
    "INSERT INTO sessions (date, court, shuttle) VALUES (?, ?, ?)",
    [date, court, shuttle],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const sessionId = this.lastID;
      attendees.forEach((playerId) => {
        db.run("INSERT INTO session_attendees (session_id, player_id) VALUES (?, ?)", [sessionId, playerId]);
      });

      res.json({ id: sessionId, date, court, shuttle, attendees });
    }
  );
});

// List sessions with attendees
app.get("/api/sessions", (req, res) => {
  db.all("SELECT * FROM sessions", [], (err, sessions) => {
    if (err) return res.status(500).json({ error: err.message });

    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length === 0) return res.json([]);

    db.all(
      `SELECT sa.session_id, p.name 
       FROM session_attendees sa 
       JOIN players p ON sa.player_id = p.id 
       WHERE sa.session_id IN (${sessionIds.map(() => "?").join(",")})`,
      sessionIds,
      (err2, attendees) => {
        if (err2) return res.status(500).json({ error: err2.message });

        const sessionMap = {};
        sessions.forEach((s) => (sessionMap[s.id] = { ...s, attendees: [] }));
        attendees.forEach((a) => {
          sessionMap[a.session_id].attendees.push(a.name);
        });

        res.json(Object.values(sessionMap));
      }
    );
  });
});

// ----------- PLAYER-WISE REPORT ----------
app.get("/api/reports/player-wise", (req, res) => {
  db.all("SELECT * FROM players", [], (err, players) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      `SELECT s.id as session_id, s.date, s.court, s.shuttle, p.id as player_id, p.name
       FROM sessions s
       JOIN session_attendees sa ON s.id = sa.session_id
       JOIN players p ON sa.player_id = p.id`,
      [],
      (err2, rows) => {
        if (err2) return res.status(500).json({ error: err2.message });

        const report = players.map((pl) => {
          const sessions = rows.filter((r) => r.player_id === pl.id);
          let totalCost = 0;
          let details = [];

          sessions.forEach((s) => {
            const perShare = (s.court + s.shuttle) / rows.filter((x) => x.session_id === s.session_id).length;
            totalCost += perShare;
            details.push({
              date: s.date,
              court: s.court,
              shuttle: s.shuttle,
              share: perShare.toFixed(2),
            });
          });

          const balance = pl.deposit - totalCost;

          return {
            name: pl.name,
            deposit: pl.deposit,
            spent: totalCost.toFixed(2),
            balance: balance.toFixed(2),
            sessions: details,
          };
        });

        res.json(report);
      }
    );
  });
});

// ----------- SERVE FRONTEND ----------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Start server
app.listen(PORT, () => console.log(`✅ Server running at http://localhost:${PORT}`));
