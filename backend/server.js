const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---- Database ----
const db = new sqlite3.Database('./badminton.db');

// Create tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    balance REAL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    amount REAL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    court_cost REAL,
    shuttle_cost REAL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS session_attendees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER,
    player_id INTEGER,
    FOREIGN KEY(session_id) REFERENCES sessions(id),
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);
});

// ---- Authentication ----
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    res.json({ ok: true, username: 'admin' });
  } else {
    res.status(401).json({ ok: false, message: 'Invalid credentials' });
  }
});

// ---- Players ----
app.get('/api/players', (req, res) => {
  db.all(`SELECT * FROM players`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/players', (req, res) => {
  const { name } = req.body;
  db.run(`INSERT INTO players (name) VALUES (?)`, [name], function (err) {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ id: this.lastID, name, balance: 0 });
  });
});

// ---- Deposits ----
app.post('/api/deposits', (req, res) => {
  const { player_id, amount } = req.body;
  db.run(`INSERT INTO deposits (player_id, amount) VALUES (?, ?)`, [player_id, amount], function (err) {
    if (err) return res.status(400).json({ error: err.message });

    db.run(`UPDATE players SET balance = balance + ? WHERE id = ?`, [amount, player_id]);
    res.json({ id: this.lastID, player_id, amount });
  });
});

// ---- Sessions ----
app.post('/api/sessions', (req, res) => {
  const { date, court_cost, shuttle_cost, attendees } = req.body;
  db.run(
    `INSERT INTO sessions (date, court_cost, shuttle_cost) VALUES (?, ?, ?)`,
    [date, court_cost, shuttle_cost],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });

      const sessionId = this.lastID;
      const stmt = db.prepare(`INSERT INTO session_attendees (session_id, player_id) VALUES (?, ?)`);
      attendees.forEach(pid => stmt.run(sessionId, pid));
      stmt.finalize();

      res.json({ id: sessionId, date, court_cost, shuttle_cost, attendees });
    }
  );
});

// Get all sessions with attendees
app.get('/api/sessions', (req, res) => {
  const sql = `
    SELECT s.id, s.date, s.court_cost, s.shuttle_cost,
           GROUP_CONCAT(p.name, ', ') AS attendees
    FROM sessions s
    LEFT JOIN session_attendees sa ON sa.session_id = s.id
    LEFT JOIN players p ON sa.player_id = p.id
    GROUP BY s.id
    ORDER BY s.date DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Player transaction history
app.get('/api/players/:id/history', (req, res) => {
  const playerId = req.params.id;
  const depositsSql = `SELECT amount, created_at, 'deposit' AS type FROM deposits WHERE player_id = ?`;
  const sessionsSql = `
    SELECT (-(s.court_cost + s.shuttle_cost) / COUNT(sa.player_id)) AS amount,
           s.date as created_at,
           'session' AS type
    FROM sessions s
    JOIN session_attendees sa ON sa.session_id = s.id
    WHERE sa.player_id = ?
    GROUP BY s.id
  `;

  db.all(depositsSql, [playerId], (err, deposits) => {
    if (err) return res.status(500).json({ error: err.message });
    db.all(sessionsSql, [playerId], (err2, sessions) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json([...deposits, ...sessions].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)));
    });
  });
});

// ---- Export balances ----
app.get('/api/export', (req, res) => {
  db.all(`SELECT name, balance FROM players`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    let csv = "Player,Balance\n" + rows.map(r => `${r.name},${r.balance}`).join("\n");
    res.header("Content-Type", "text/csv");
    res.attachment("balances.csv");
    res.send(csv);
  });
});

// ---- Serve frontend ----
app.use(express.static(path.join(__dirname, '../frontend')));

// ---- Start server ----
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
