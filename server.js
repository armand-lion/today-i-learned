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
const db = new sqlite3.Database(path.join(__dirname, 'today_i_learned.db'), (err) => {
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

// Automatisch de database vullen via INSERT OR IGNORE (Waterdichte server-methode)
db.serialize(() => {
  console.log("Database seed-controle wordt uitgevoerd...");

  const initialFacts = [
    {
      id: 1,
      text: "The shortest war in history lasted 38 minutes! It was between Britain and Zanzibar on August 27, 1896.",
      source: "https://historic-uk.com",
      category: "history",
      votesInteresting: 15,
      votesMindblowing: 8,
      votesFalse: 2
    },
    {
      id: 2,
      text: "The first 1GB hard drive was made in 1980 and had a price of \$40,000!",
      source: "https://autodesk.com",
      category: "history",
      votesInteresting: 4,
      votesMindblowing: 1,
      votesFalse: 0
    },
    {
      id: 3,
      text: '"typewriter" is the longest English word you can type using 1 row of the QWERTY keyboard',
      source: "https://twitter.com",
      category: "technology",
      votesInteresting: 9,
      votesMindblowing: 1,
      votesFalse: 0
    },
    {
      id: 4,
      text: "Human DNA is 99.9% identical from person to person",
      source: "https://genome.gov",
      category: "science",
      votesInteresting: 4,
      votesMindblowing: 9,
      votesFalse: 1
    },
    {
      id: 5,
      text: "The less money you spend, the more you save!",
      source: "https://bankofamerica.com",
      category: "finance",
      votesInteresting: 2,
      votesMindblowing: 1,
      votesFalse: 0
    },
    {
      id: 6,
      text: "Millennial dads spend 3 times as much time with their kids than their fathers spent with them.",
      source: "https://mother.ly",
      category: "society",
      votesInteresting: 12,
      votesMindblowing: 2,
      votesFalse: 0
    },
    {
      id: 7,
      text: "There is enough DNA in the average person’s body to stretch from the sun to Pluto and back — 17 times",
      source: "https://stackexchange.com",
      category: "science",
      votesInteresting: 7,
      votesMindblowing: 13,
      votesFalse: 2
    },
    {
      id: 8,
      text: "React was developed by Google",
      source: "https://example.com",
      category: "technology",
      votesInteresting: 1,
      votesMindblowing: 0,
      votesFalse: 9
    },
    {
      id: 9,
      text: "As of 2023, Breaking Bad is the highest-rated TV show on IMDb with a rating of 9.4/10",
      source: "https://imdb.com",
      category: "entertainment",
      votesInteresting: 11,
      votesMindblowing: 6,
      votesFalse: 2
    },
    {
      id: 10,
      text: "Lisbon is the capital of Portugal",
      source: "https://wikipedia.org",
      category: "society",
      votesInteresting: 8,
      votesMindblowing: 5,
      votesFalse: 2
    },
    {
      id: 11,
      text: "React is being developed by Meta (formerly facebook)",
      source: "https://fb.com",
      category: "technology",
      votesInteresting: 24,
      votesMindblowing: 9,
      votesFalse: 4
    }
  ];

  // INSERT OR IGNORE zorgt ervoor dat bestaande ID's worden overgeslagen en ontbrekende worden toegevoegd!
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO facts (id, text, source, category, votesInteresting, votesMindblowing, votesFalse) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  initialFacts.forEach(fact => {
    stmt.run(
      fact.id,
      fact.text, 
      fact.source, 
      fact.category, 
      fact.votesInteresting, 
      fact.votesMindblowing, 
      fact.votesFalse,
      (err) => {
        if (err) console.error("Fout bij invoegen feitje:", err.message);
      }
    );
  });
  
  stmt.finalize();
  console.log("Database succesvol gecontroleerd en bijgewerkt!");
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
