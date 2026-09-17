const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// 1. Open de database absoluut via __dirname
const db = new sqlite3.Database(path.join(__dirname, 'today_i_learned.db'), (err) => {
  if (err) console.error('Database verbindingsfout:', err.message);
  else console.log('--> Verbonden met de lokale SQLite database.');
});

// 2. Start de database-opbouw synchroon
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
  `, (err) => {
    if (err) return console.error("Fout bij aanmaken tabel:", err.message);

    db.get("SELECT COUNT(*) as count FROM facts", [], (err, row) => {
      if (err) return console.error("Fout bij tellen rijen:", err.message);

      if (row.count === 0) {
        console.log("--> Database is leeg. Start invoeren standaard data...");

        const initialFacts = [
          { text: "The shortest war in history lasted 38 minutes! It was between Britain and Zanzibar on August 27, 1896.", source: "https://historic-uk.com", category: "history", votesInteresting: 15, votesMindblowing: 8, votesFalse: 2 },
          { text: "The first 1GB hard drive was made in 1980 and had a price of \$40,000!", source: "https://autodesk.com", category: "history", votesInteresting: 4, votesMindblowing: 1, votesFalse: 0 },
          { text: '"typewriter" is the longest English word you can type using 1 row of the QWERTY keyboard', source: "https://twitter.com", category: "technology", votesInteresting: 9, votesMindblowing: 1, votesFalse: 0 },
          { text: "Human DNA is 99.9% identical from person to person", source: "https://genome.gov", category: "science", votesInteresting: 4, votesMindblowing: 9, votesFalse: 1 },
          { text: "The less money you spend, the more you save!", source: "https://bankofamerica.com", category: "finance", votesInteresting: 2, votesMindblowing: 1, votesFalse: 0 },
          { text: "Millennial dads spend 3 times as much time with their kids than their fathers spent with them.", source: "https://mother.ly", category: "society", votesInteresting: 12, votesMindblowing: 2, votesFalse: 0 },
          { text: "There is enough DNA in the average person’s body to stretch from the sun to Pluto and back — 17 times", source: "https://stackexchange.com", category: "science", votesInteresting: 7, votesMindblowing: 13, votesFalse: 2 },
          { text: "React was developed by Google", source: "https://example.com", category: "technology", votesInteresting: 1, votesMindblowing: 0, votesFalse: 9 },
          { text: "As of 2023, Breaking Bad is the highest-rated TV show on IMDb with a rating of 9.4/10", source: "https://imdb.com", category: "entertainment", votesInteresting: 11, votesMindblowing: 6, votesFalse: 2 },
          { text: "Lisbon is the capital of Portugal", source: "https://wikipedia.org", category: "society", votesInteresting: 8, votesMindblowing: 5, votesFalse: 2 },
          { text: "React is being developed by Meta (formerly facebook)", source: "https://fb.com", category: "technology", votesInteresting: 24, votesMindblowing: 9, votesFalse: 4 }
        ];

        const stmt = db.prepare("INSERT INTO facts (text, source, category, votesInteresting, votesMindblowing, votesFalse) VALUES (?, ?, ?, ?, ?, ?)");
        initialFacts.forEach(fact => {
          stmt.run(fact.text, fact.source, fact.category, fact.votesInteresting, fact.votesMindblowing, fact.votesFalse);
        });
        stmt.finalize((err) => {
          if (!err) console.log("--> Standaard data succesvol ingevoerd in SQLite!");
        });
      } else {
        console.log(`--> Database bevat al \${row.count} feitjes.`);
      }
    });
  });
});

// ==================== REGELEFFECTIVITEIT: API ROUTES ALTIJD EERST! ====================

// Route A: Alle feitjes ophalen
app.get('/api/facts', (req, res) => {
  db.all("SELECT * FROM facts ORDER BY created_at DESC", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Route B: Nieuw feitje toevoegen
app.post('/api/facts', (req, res) => {
  const { text, source, category } = req.body;
  db.run(`INSERT INTO facts (text, source, category) VALUES (?, ?, ?)`, [text, source, category], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, text, source, category, votesInteresting: 0, votesMindblowing: 0, votesFalse: 0 });
  });
});

// Route C: Stemmen updaten
app.post('/api/facts/:id/vote', (req, res) => {
  const { columnName } = req.body;
  const sql = `UPDATE facts SET \${columnName} = \${columnName} + 1 WHERE id = ?`;
  db.run(sql, [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get("SELECT * FROM facts WHERE id = ?", [req.params.id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

// ==================== REGELEFFECTIVITEIT: STATISCHE EN WILDCARD ROUTES ALS LAATSTE! ====================

// Serveer statische bestanden uit de build map
app.use(express.static(path.join(__dirname, 'build')));

// Wildcard route vangt overige paden op en stuurt de index.html terug
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Dynamische poort voor Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`--> Backend server draait op poort \${PORT}`));
