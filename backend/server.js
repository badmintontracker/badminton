/* server.js */
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const DB_PATH = path.join(__dirname, 'badminton.db');
const FRONTEND_DIR = path.join(__dirname, '../frontend');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(FRONTEND_DIR));

const db = new sqlite3.Database(DB_PATH);

// ---- DB INIT ----
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      date TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      attendees INTEGER NOT NULL,
      court_cost REAL NOT NULL,
      shuttle_cost REAL NOT NULL,
      charge REAL NOT NULL,
      date TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(player_id) REFERENCES players(id) ON DELETE CASCADE
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);

  // Defaults: court 400, shuttle 100
  db.run(
    `INSERT OR IGNORE INTO settings (key, value) VALUES ('court_cost','400'), ('shuttle_cost','100')`
  );
});

// ---- Helpers ----
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}
function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

// ---- SETTINGS ----
app.get('/api/settings', async (req, res) => {
  try {
    const rows = await all(db, `SELECT key, value FROM settings`);
    const obj = rows.reduce((acc, r) => ({ ...acc, [r.key]: r.value }), {});
    res.json(obj);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const { court_cost, shuttle_cost } = req.body;
    if (court_cost == null || shuttle_cost == null)
      return res.status(400).json({ error: 'court_cost and shuttle_cost required' });

    await run(db, `INSERT INTO settings(key,value) VALUES('court_cost',?) 
                   ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [String(court_cost)]);
    await run(db, `INSERT INTO settings(key,value) VALUES('shuttle_cost',?) 
                   ON CONFLICT(key) DO UPDATE SET value=excluded.value`, [String(shuttle_cost)]);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- PLAYERS (summary) ----
app.get('/api/players', async (req, res) => {
  try {
    const rows = await all(
      db,
      `
      SELECT 
        p.id, p.name, p.created_at,
        IFNULL(d.total_deposits,0) AS total_deposits,
        IFNULL(s.session_count,0) AS session_count,
        IFNULL(s.total_charges,0) AS total_charges,
        (IFNULL(d.total_deposits,0) - IFNULL(s.total_charges,0)) AS balance
      FROM players p
      LEFT JOIN (
        SELECT player_id, SUM(amount) AS total_deposits
        FROM deposits
        GROUP BY player_id
      ) d ON d.player_id = p.id
      LEFT JOIN (
        SELECT player_id, COUNT(*) AS session_count, SUM(charge) AS total_charges
        FROM sessions
        GROUP BY player_id
      ) s ON s.player_id = p.id
      ORDER BY LOWER(p.name)
      `
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/players', async (req, res) => {
  try {
    const { name, initialDeposit } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });

    const insert = await run(db, `INSERT INTO players(name) VALUES(?)`, [name.trim()]);
    const playerId = insert.lastID;

    const initial = Number(initialDeposit ?? 0);
    if (!Number.isNaN(initial) && initial > 0) {
      await run(db, `INSERT INTO deposits(player_id, amount) VALUES(?, ?)`, [playerId, initial]);
    }

    const player = await get(db, `SELECT id, name, created_at FROM players WHERE id=?`, [playerId]);
    res.json(player);
  } catch (e) {
    if (e && /UNIQUE/i.test(e.message)) {
      res.status(409).json({ error: 'Player with that name already exists' });
    } else {
      res.status(500).json({ error: e.message });
    }
  }
});

app.put('/api/players/:id', async (req, res) => {
  try {
    const { name } = req.body;
    const { id } = req.params;
    if (!name || !name.trim()) return res.status(400).json({ error: 'name required' });

    await run(db, `UPDATE players SET name=? WHERE id=?`, [name.trim(), id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/players/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(db, `DELETE FROM players WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- TRANSACTION HISTORY per player ----
app.get('/api/players/:id/history', async (req, res) => {
  try {
    const { id } = req.params;
    const deposits = await all(db, `SELECT id, amount, date FROM deposits WHERE player_id=? ORDER BY date DESC, id DESC`, [id]);
    const sessions = await all(db, `SELECT id, attendees, court_cost, shuttle_cost, charge, date FROM sessions WHERE player_id=? ORDER BY date DESC, id DESC`, [id]);
    res.json({ deposits, sessions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- DEPOSITS ----
app.post('/api/deposits', async (req, res) => {
  try {
    const { playerId, amount, date } = req.body;
    if (!playerId || amount == null) return res.status(400).json({ error: 'playerId and amount required' });

    const stmt = await run(
      db,
      `INSERT INTO deposits(player_id, amount, date) VALUES(?,?, COALESCE(?, datetime('now')))`,
      [playerId, Number(amount), date || null]
    );
    const row = await get(db, `SELECT * FROM deposits WHERE id=?`, [stmt.lastID]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/deposits/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(db, `DELETE FROM deposits WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- SESSIONS ----
app.post('/api/sessions', async (req, res) => {
  try {
    const { playerId, attendees, courtCost, shuttleCost, date } = req.body;
    if (!playerId || !attendees) return res.status(400).json({ error: 'playerId and attendees required' });

    const cc = Number(courtCost);
    const sc = Number(shuttleCost);
    if (Number.isNaN(cc) || Number.isNaN(sc)) return res.status(400).json({ error: 'courtCost and shuttleCost must be numbers' });

    const att = Number(attendees);
    if (att <= 0) return res.status(400).json({ error: 'attendees must be > 0' });

    const charge = (cc + sc) / att;

    const stmt = await run(
      db,
      `INSERT INTO sessions(player_id, attendees, court_cost, shuttle_cost, charge, date)
       VALUES(?,?,?,?,?, COALESCE(?, datetime('now')))`
      ,
      [playerId, att, cc, sc, charge, date || null]
    );

    const row = await get(db, `SELECT * FROM sessions WHERE id=?`, [stmt.lastID]);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run(db, `DELETE FROM sessions WHERE id=?`, [id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- EXCEL DATA FEED (OPTIONAL JSON, FRONTEND CREATES XLSX) ----
app.get('/api/export-data', async (req, res) => {
  try {
    const players = await all(db, `
      SELECT p.id, p.name,
             IFNULL(d.total_deposits,0) as total_deposits,
             IFNULL(s.session_count,0) as session_count,
             IFNULL(s.total_charges,0) as total_charges,
             (IFNULL(d.total_deposits,0) - IFNULL(s.total_charges,0)) AS balance
      FROM players p
      LEFT JOIN (SELECT player_id, SUM(amount) as total_deposits FROM deposits GROUP BY player_id) d ON d.player_id = p.id
      LEFT JOIN (SELECT player_id, COUNT(*) as session_count, SUM(charge) as total_charges FROM sessions GROUP BY player_id) s ON s.player_id = p.id
      ORDER BY LOWER(p.name)
    `);

    const deposits = await all(db, `
      SELECT d.id, d.player_id, p.name as player_name, d.amount, d.date
      FROM deposits d JOIN players p ON p.id = d.player_id
      ORDER BY d.date DESC, d.id DESC
    `);

    const sessions = await all(db, `
      SELECT s.id, s.player_id, p.name as player_name, s.attendees, s.court_cost, s.shuttle_cost, s.charge, s.date
      FROM sessions s JOIN players p ON p.id = s.player_id
      ORDER BY s.date DESC, s.id DESC
    `);

    const settings = await all(db, `SELECT key, value FROM settings`);
    res.json({ players, deposits, sessions, settings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Fallback to SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Badminton Tracker API running on http://localhost:${PORT}`));
