const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend")));

// SQLite setup
const db = new sqlite3.Database("./badminton.db");

// Create tables
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      deposit INTEGER DEFAULT 0
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      court INTEGER,
      shuttle INTEGER
    )`
  );

  db.run(
    `CREATE TABLE IF NOT EXISTS attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER,
      player_id INTEGER,
      FOREIGN KEY(session_id) REFERENCES sessions(id),
      FOREIGN KEY(player_id) REFERENCES players(id)
    )`
  );
});

// Add deposit
app.post("/api/deposit", (req, res) => {
  const { name, amount } = req.body;
  db.run(
    `INSERT INTO players (name, deposit) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET deposit = deposit + ?`,
    [name, amount, amount],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// Add session
app.post("/api/session", (req, res) => {
  const { date, court, shuttle, attendees } = req.body;

  db.run(
    `INSERT INTO sessions (date, court, shuttle) VALUES (?, ?, ?)`,
    [date, court, shuttle],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });

      const sessionId = this.lastID;
      attendees.forEach((name) => {
        db.run(
          `INSERT INTO players (name) VALUES (?)
           ON CONFLICT(name) DO NOTHING`,
          [name]
        );
        db.get(`SELECT id FROM players WHERE name = ?`, [name], (err, row) => {
          if (row) {
            db.run(
              `INSERT INTO attendees (session_id, player_id) VALUES (?, ?)`,
              [sessionId, row.id]
            );
          }
        });
      });

      res.json({ ok: true });
    }
  );
});

// Get all sessions with attendees
app.get("/api/sessions", (req, res) => {
  db.all(`SELECT * FROM sessions`, [], (err, sessions) => {
    if (err) return res.status(500).json({ error: err.message });

    const promises = sessions.map(
      (s) =>
        new Promise((resolve) => {
          db.all(
            `SELECT p.name FROM attendees a
             JOIN players p ON a.player_id = p.id
             WHERE a.session_id = ?`,
            [s.id],
            (err, attendees) => {
              resolve({
                ...s,
                attendees: attendees.map((a) => a.name),
              });
            }
          );
        })
    );

    Promise.all(promises).then((data) => res.json(data));
  });
});

// Player-wise report (transparent balances)
app.get("/api/report", (req, res) => {
  db.all(`SELECT * FROM players`, [], (err, players) => {
    if (err) return res.status(500).json({ error: err.message });

    const report = [];

    const promises = players.map(
      (p) =>
        new Promise((resolve) => {
          db.all(
            `SELECT s.date, s.court, s.shuttle
             FROM attendees a
             JOIN sessions s ON a.session_id = s.id
             WHERE a.player_id = ?`,
            [p.id],
            (err, sessions) => {
              let spent = 0;
              sessions.forEach((s) => {
                const total = s.court + s.shuttle;
                db.get(
                  `SELECT COUNT(*) as cnt FROM attendees WHERE session_id = ?`,
                  [s.id],
                  (err, row) => {
                    const share = total / row.cnt;
                    spent += share;
                  }
                );
              });

              setTimeout(() => {
                resolve({
                  name: p.name,
                  deposit: p.deposit,
                  balance: p.deposit - spent,
                });
              }, 200); // wait for async queries
            }
          );
        })
    );

    Promise.all(promises).then((rows) => res.json(rows));
  });
});

// Root route -> serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
