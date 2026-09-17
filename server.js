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
// Automatisch de database vullen als deze nog leeg is
db.get("SELECT COUNT(*) as count FROM facts", [], (err, row) => {
  if (!err && row.count === 0) {
    console.log("Database is leeg. Standaard data invoeren...");
    
    const initialFacts = [
      {
        text: "The shortest war in history lasted 38 minutes! It was between Britain and Zanzibar on August 27, 1896. It was over the ascension of the next Sultan in Zanzibar and resulted in a British victory.",
        source: "https://www.historic-uk.com/HistoryUK/HistoryofBritain/The-Shortest-War-in-History/#:~:text=The%20little%20known%20Anglo%2DZanzibar,Britain%20and%20Germany%20in%201890.",
        category: "history",
        votesInteresting: "15",
        votesMindblowing: "8",
        votesFalse: "2",
      },
      {
        text: "The first 1GB hard drive was made in 1980 and had a price of $40,000!",
        source: "https://www.autodesk.com/products/fusion-360/blog/a-look-back-at-the-first-built-in-hard-drive/#:~:text=The%20Rapidly%20Evolving%20HDD&text=In%201980%2C%20we%20saw%20the,around%20for%20a%20long%20time.",
        category: "history",
        votesInteresting: "4",
        votesMindblowing: "1",
        votesFalse: "0",
      },
      {
        text: "\"typewriter\" is the longest English word you can type using 1 row of the QWERTY keyboard",
        source: "https://twitter.com/intel/status/442074967522684928",
        category: "technology",
        votesInteresting: "9",
        votesMindblowing: "1",
        votesFalse: "0",
      },
      {
        text: "Human DNA is 99.9% identical from person to person",
        source: "https://www.genome.gov/about-genomics/fact-sheets/Genetics-vs-Genomics",
        category: "science",
        votesInteresting: "4",
        votesMindblowing: "9",
        votesFalse: "1",
      },
      {
        text: "The less money you spend, the more you save!",
        source: "https://bettermoneyhabits.bankofamerica.com/en/saving-budgeting/ways-to-save-money",
        category: "finance",
        votesInteresting: "2",
        votesMindblowing: "1",
        votesFalse: "0",
      },
      {
        text: "Millennial dads spend 3 times as much time with their kids than their fathers spent with them. In 1982, 43% of fathers had never changed a diaper. Today, that number is down to 3%",
        source: "https://www.mother.ly/parenting/millennial-dads-spend-more-time-with-their-kids",
        category: "society",
        votesInteresting: "12",
        votesMindblowing: "2",
        votesFalse: "0",
      },
      {
        text: "There is enough DNA in the average person’s body to stretch from the sun to Pluto and back — 17 times",
        source: "https://skeptics.stackexchange.com/questions/10606/length-of-uncoiled-human-dna",
        category: "science",
        votesInteresting: "7",
        votesMindblowing: "13",
        votesFalse: "2",
      },
      {
        text: "React was developed by Google",
        source: "https://example.com",
        category: "technology",
        votesInteresting: "1",
        votesMindblowing: "0",
        votesFalse: "9",
      },
      {
        text: "As of 2023, Breaking Bad is the highest-rated TV show on IMDb with a rating of 9.4/10",
        source: "https://www.imdb.com/chart/toptv/",
        category: "entertainment",
        votesInteresting: "11",
        votesMindblowing: "6",
        votesFalse: "2",
      },
            {
        text: "Lisbon is the capital of Portugal",
        source: "https://en.wikipedia.org/wiki/Lisbon",
        category: "society",
        votesInteresting: "8",
        votesMindblowing: "5",
        votesFalse: "2",
      },
            {
        text: "React is being developed by Meta (formerly facebook)",
        source: "https://opensource.fb.com/",
        category: "technology",
        votesInteresting: "24",
        votesMindblowing: "9",
        votesFalse: "4",
      },
    ];

    const stmt = db.prepare("INSERT INTO facts (text, source, category) VALUES (?, ?, ?)");
    initialFacts.forEach(fact => {
      stmt.run(fact.text, fact.source, fact.category);
    });
    stmt.finalize();
    console.log("Standaard data succesvol toegevoegd!");
  }
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
