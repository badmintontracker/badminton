const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.json());

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
    court INTEGER,
    shuttle INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    player_id INTEGER,
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);
});

// Login (simple demo)
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "admin" && password === "admin123") {
    res.json({ ok: true, username: "admin" });
  } else {
    res.status(401).json({ ok: false, message: "Invalid login" });
  }
});

// Add deposit
app.post("/api/deposit", (req, res) => {
  const { name, amount } = req.body;
  db.run(
    `INSERT INTO players (name, deposit) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET deposit = deposit + ?`,
    [name, amount, amount],
    function (err) {
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
      attendees.forEach((player) => {
        db.run(
          `INSERT OR IGNORE INTO players (name) VALUES (?)`,
          [player],
          () => {
            db.get(
              `SELECT id FROM players WHERE name = ?`,
              [player],
              (err, row) => {
                if (row) {
                  db.run(
                    `INSERT INTO attendees (session_id, player_id) VALUES (?, ?)`,
                    [sessionId, row.id]
                  );
                }
              }
            );
          }
        );
      });
      res.json({ ok: true });
    }
  );
});

// Get all sessions with attendees and share
app.get("/api/sessions", (req, res) => {
  db.all(
    `SELECT s.id, s.date, s.court, s.shuttle,
            GROUP_CONCAT(p.name) as attendees
     FROM sessions s
     LEFT JOIN attendees a ON s.id = a.session_id
     LEFT JOIN players p ON a.player_id = p.id
     GROUP BY s.id
     ORDER BY s.date DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const sessions = rows.map((row) => {
        const names = row.attendees ? row.attendees.split(",") : [];
        const totalCost = row.court + row.shuttle;
        const perShare = names.length > 0 ? totalCost / names.length : 0;
        return {
          id: row.id,
          date: row.date,
          court: row.court,
          shuttle: row.shuttle,
          attendees: names,
          share: perShare
        };
      });
      res.json(sessions);
    }
  );
});

// Player-wise report
app.get("/api/reports", (req, res) => {
  db.all(`SELECT * FROM players`, [], (err, players) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all(
      `SELECT s.id, s.date, s.court, s.shuttle, GROUP_CONCAT(p.name) as attendees
       FROM sessions s
       LEFT JOIN attendees a ON s.id = a.session_id
       LEFT JOIN players p ON a.player_id = p.id
       GROUP BY s.id`,
      [],
      (err2, sessions) => {
        if (err2) return res.status(500).json({ error: err2.message });

        // Build player report
        const report = players.map((pl) => {
          let spent = 0;
          const history = [];

          sessions.forEach((s) => {
            const names = s.attendees ? s.attendees.split(",") : [];
            const totalCost = s.court + s.shuttle;
            const perShare = names.length > 0 ? totalCost / names.length : 0;

            if (names.includes(pl.name)) {
              spent += perShare;
              history.push({
                date: s.date,
                court: s.court,
                shuttle: s.shuttle,
                share: perShare
              });
            }
          });

          return {
            name: pl.name,
            deposit: pl.deposit,
            spent,
            balance: pl.deposit - spent,
            sessions: history
          };
        });

        res.json(report);
      }
    );
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
