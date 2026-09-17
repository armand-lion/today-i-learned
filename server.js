const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const path = require('path');

// Vertel Node.js dat de map 'dist' (of 'build') de statische frontend-bestanden bevat
app.use(express.static(path.join(__dirname, 'build'))); 

// Zorg dat alle overige routes (behalve je /api/ routes) de index.html laden
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});


// 1. Maak of open de SQLite database
const db = new sqlite3.Database('./today_i_learned.db', (err) => {
  if (err) console.error('Database fout:', err.message);
  else console.log('Verbonden met de lokale SQLite database.');
});

// 2. Maak de 'facts' tabel aan als deze nog niet bestaat
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      source TEXT,
      category TEXT NOT NULL,
      votesInteresting INTEGER DEFAULT 0,
      votesMindblowing INTEGER DEFAULT 0,
      votesFalse INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// 3. API Route: Alle feitjes ophalen (Vervangt Supabase .select())
app.get('/api/facts', (req, res) => {
  db.all("SELECT * FROM facts ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// 4. API Route: Nieuw feitje toevoegen (Vervangt Supabase .insert())
app.post('/api/facts', (req, res) => {
  const { text, source, category } = req.body;
  const sql = `INSERT INTO facts (text, source, category) VALUES (?, ?, ?)`;
  
  db.run(sql, [text, source, category], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Geef het zojuist aangemaakte feitje direct terug aan React
    res.json({
      id: this.lastID,
      text,
      source,
      category,
      votesInteresting: 0,
      votesMindblowing: 0,
      votesFalse: 0
    });
  });
});

// 5. API Route: Stemmen updaten (Vervang de oude in server.js)
app.post('/api/facts/:id/vote', (req, res) => {
  const { columnName } = req.body; // Ontvangt bijv. 'votesInteresting'
  const factId = req.params.id;
  
  const allowedColumns = ['votesInteresting', 'votesMindblowing', 'votesFalse'];
  
  // Veiligheidscheck: voorkom SQL-injecties
  if (!allowedColumns.includes(columnName)) {
    return res.status(400).json({ error: "Ongeldige stem-kolom" });
  }

  // LET OP: Geen backslashes bij de template literals!
  const sql = `UPDATE facts SET ${columnName} = ${columnName} + 1 WHERE id = ?`;
  
  db.run(sql, [factId], function(err) {
    if (err) {
      console.error("SQL Error tijdens stemmen:", err.message);
      return res.status(500).json({ error: err.message });
    }
    
    // Haal het feitje opnieuw op zodat React direct de nieuwe teller krijgt
    db.get("SELECT * FROM facts WHERE id = ?", [factId], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

app.listen(5000, () => console.log('Backend server draait op http://localhost:5000'));
