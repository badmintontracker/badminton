const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = 8080;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// --- DB Setup ---
const db = new sqlite3.Database("./badminton.db");

// create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player TEXT,
    amount INTEGER,
    date TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    court INTEGER,
    shuttle INTEGER,
    attendees TEXT
  )`);
});

// --- Authentication ---
const ADMIN = { username: "admin", password: "admin123" };

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN.username && password === ADMIN.password) {
    res.json({ ok: true, username });
  } else {
    res.status(401).json({ ok: false, message: "Invalid credentials" });
  }
});

// --- Deposits ---
app.post("/api/deposits", (req, res) => {
  const { player, amount, date } = req.body;
  db.run(
    "INSERT INTO deposits (player, amount, date) VALUES (?, ?, ?)",
    [player, amount, date],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get("/api/deposits", (req, res) => {
  db.all("SELECT * FROM deposits", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// --- Sessions ---
app.post("/api/sessions", (req, res) => {
  const { date, court, shuttle, attendees } = req.body;
  db.run(
    "INSERT INTO sessions (date, court, shuttle, attendees) VALUES (?, ?, ?, ?)",
    [date, court, shuttle, attendees.join(",")],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

app.get("/api/sessions", (req, res) => {
  db.all("SELECT * FROM sessions", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(r => {
      r.attendees = r.attendees ? r.attendees.split(",") : [];
    });
    res.json(rows);
  });
});

// --- Reports (Balances & Player History) ---
app.get("/api/reports", async (req, res) => {
  db.all("SELECT * FROM deposits", [], (err, deposits) => {
    if (err) return res.status(500).json({ error: err.message });

    db.all("SELECT * FROM sessions", [], (err2, sessions) => {
      if (err2) return res.status(500).json({ error: err2.message });

      sessions.forEach(s => {
        s.attendees = s.attendees ? s.attendees.split(",") : [];
      });

      let players = {};

      // add deposits
      deposits.forEach(d => {
        if (!players[d.player]) players[d.player] = { deposits: [], sessions: [], balance: 0 };
        players[d.player].deposits.push(d);
        players[d.player].balance += d.amount;
      });

      // deduct session shares
      sessions.forEach(s => {
        const cost = (s.court || 0) + (s.shuttle || 0);
        const perShare = s.attendees.length > 0 ? cost / s.attendees.length : 0;
        s.perShare = perShare;

        s.attendees.forEach(p => {
          if (!players[p]) players[p] = { deposits: [], sessions: [], balance: 0 };
          players[p].sessions.push({ ...s, share: perShare });
          players[p].balance -= perShare;
        });
      });

      res.json({ players, deposits, sessions });
    });
  });
});

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
