const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const db = new sqlite3.Database('badminton.db');

// ---------------------- Tables ----------------------
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    deposit REAL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    amount REAL,
    date TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER,
    date TEXT,
    FOREIGN KEY(player_id) REFERENCES players(id)
  )`);
});

// ---------------------- Players ----------------------
app.post('/players', (req, res) => {
  const { name, deposit } = req.body;
  db.run(`INSERT OR IGNORE INTO players(name, deposit) VALUES(?,?)`, [name, deposit || 0], function(err){
    if(err) return res.status(500).send(err.message);
    res.json({success:true});
  });
});

app.get('/players', (req,res)=>{
  db.all(`SELECT * FROM players`, [], (err, rows)=>{
    if(err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

// ---------------------- Expenses ----------------------
app.post('/expenses', (req,res)=>{
  const { type, amount, date } = req.body;
  db.run(`INSERT INTO expenses(type,amount,date) VALUES(?,?,?)`, [type, amount, date], function(err){
    if(err) return res.status(500).send(err.message);
    res.json({success:true});
  });
});

app.get('/expenses', (req,res)=>{
  db.all(`SELECT * FROM expenses ORDER BY date DESC`, [], (err, rows)=>{
    if(err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

// ---------------------- Attendance ----------------------
app.post('/attendance', (req,res)=>{
  const { player_id, date } = req.body;
  db.run(`INSERT INTO attendance(player_id,date) VALUES(?,?)`, [player_id,date], function(err){
    if(err) return res.status(500).send(err.message);
    res.json({success:true});
  });
});

app.get('/attendance/:date', (req,res)=>{
  const date = req.params.date;
  db.all(`SELECT p.name FROM attendance a JOIN players p ON a.player_id = p.id WHERE a.date=?`, [date], (err, rows)=>{
    if(err) return res.status(500).send(err.message);
    res.json(rows);
  });
});

// ---------------------- Daily Report & Balances (split costs by attendees) ----------------------
app.get('/report', (req,res)=>{
  // Get all unique dates with attendance or expenses
  db.all(`SELECT DISTINCT date FROM (
            SELECT date FROM attendance
            UNION
            SELECT date FROM expenses
          ) ORDER BY date DESC`, [], (err, dates)=>{
    if(err) return res.status(500).send(err.message);

    const dailyReports = [];
    let dateIndex = 0;

    const processDate = () => {
      if(dateIndex >= dates.length){
        // ---------------------- Compute final balances ----------------------
        db.all(`SELECT * FROM players`, [], (err, players)=>{
          if(err) return res.status(500).send(err.message);

          const balances = [];
          let completed = 0;

          players.forEach(p=>{
            let playerTotal = 0;

            // Sum per-day expenses only for days the player attended
            db.all(`SELECT e.amount FROM expenses e 
                    JOIN attendance a ON e.date = a.date 
                    WHERE a.player_id = ?`, [p.id], (err, expRows)=>{
              if(err) return res.status(500).send(err.message);

              // For each day, split expenses among attendees
              let daySums = {}; // date -> {total, attendees}
              expRows.forEach(() => {}); // we process below

              db.all(`SELECT DISTINCT a.date FROM attendance a WHERE a.player_id=?`, [p.id], (err, playerDates)=>{
                if(err) return res.status(500).send(err.message);

                let dayProcessed = 0;
                playerDates.forEach(d=>{
                  const date = d.date;

                  // total expense that day
                  db.all(`SELECT SUM(amount) AS total FROM expenses WHERE date=?`, [date], (err, totalRow)=>{
                    if(err) return res.status(500).send(err.message);

                    const totalAmount = totalRow[0].total || 0;

                    // attendees count that day
                    db.all(`SELECT COUNT(*) AS cnt FROM attendance WHERE date=?`, [date], (err, cntRow)=>{
                      if(err) return res.status(500).send(err.message);

                      const attendees = cntRow[0].cnt || 1; // avoid division by zero
                      const share = totalAmount / attendees;
                      playerTotal += share;

                      dayProcessed++;
                      if(dayProcessed===playerDates.length){
                        balances.push({
                          name: p.name,
                          deposit: p.deposit,
                          balance: p.deposit - playerTotal
                        });
                        completed++;
                        if(completed===players.length){
                          res.json({dailyReports, balances});
                        }
                      }
                    });
                  });
                });

                // no attendance days for this player
                if(playerDates.length===0){
                  balances.push({
                    name: p.name,
                    deposit: p.deposit,
                    balance: p.deposit
                  });
                  completed++;
                  if(completed===players.length){
                    res.json({dailyReports, balances});
                  }
                }
              });
            });
          });
        });
        return;
      }

      const date = dates[dateIndex].date;

      // expenses
      db.all(`SELECT e.type, e.amount FROM expenses e WHERE e.date=?`, [date], (err, expenseRows)=>{
        if(err) return res.status(500).send(err.message);

        // attendees
        db.all(`SELECT p.name FROM attendance a JOIN players p ON a.player_id=p.id WHERE a.date=?`, [date], (err, attRows)=>{
          if(err) return res.status(500).send(err.message);

          const totalExpense = expenseRows.reduce((sum,e)=>sum+e.amount,0);
          const perHead = attRows.length > 0 ? totalExpense / attRows.length : 0;

          dailyReports.push({
            date,
            expenses: expenseRows,
            attendees: attRows.map(a=>a.name),
            perHead
          });

          dateIndex++;
          processDate();
        });
      });
    };

    processDate();
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

