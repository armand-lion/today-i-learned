import { useEffect, useState } from "react";

import "./css/style.css";

function App() {
  const [showForm, setShowForm] = useState(false);
  const [facts, setFacts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCategory, setCurrentCategory] = useState("all");

  useEffect(
    function () {
      async function getFacts() {
        setIsLoading(true);
        
        try {
          // We halen alle feitjes op van onze lokale Node.js server
          const res = await fetch("/api/facts");
          if (!res.ok) throw new Error("Probleem met ophalen");
          const data = await res.json();
          
          // Hier filteren we de categorieën lokaal in React
          if (currentCategory === "all") {
            setFacts(data);
          } else {
            setFacts(data.filter((f) => f.category === currentCategory));
          }
        } catch (err) {
          alert("There was a problem getting data from the local server");
        } finally {
          setIsLoading(false);
        }
      }
      getFacts();
    },
    [currentCategory]
  );

  return (
    <>
      <Header showForm={showForm} setShowForm={setShowForm} />

      {showForm ? (
        <NewFactForm setFacts={setFacts} setShowForm={setShowForm} />
      ) : null}
      <main className="main">
        <CategoryFilter setCurrentCategory={setCurrentCategory} />
        {isLoading ? (
          <Loader />
        ) : (
          <FactsList facts={facts} setFacts={setFacts} />
        )}
      </main>
    </>
  );
}

function Loader() {
  return <p className="message">Loading...</p>;
}

function Header({ showForm, setShowForm }) {
  const appTitle = "Today I learned!";

  return (
    <header className="header">
      <div className="logo">
        <img
          src="img/favicon-192x192.png"
          height="68"
          width="68"
          alt="Today I Learned Logo"
        />
        <h1>{appTitle}</h1>
      </div>
      <button
        className="btn btn-large btn-open"
        onClick={() => setShowForm((show) => !show)}
      >
        {showForm ? "Close" : "Share a fact"}
      </button>
    </header>
  );
}

const CATEGORIES = [
  { name: "technology", color: "#3b82f6" },
  { name: "science", color: "#16a34a" },
  { name: "finance", color: "#ef4444" },
  { name: "society", color: "#eab308" },
  { name: "entertainment", color: "#db2777" },
  { name: "health", color: "#14b8a6" },
  { name: "history", color: "#f97316" },
  { name: "news", color: "#8b5cf6" },
];

function isValidHttpUrl(string) {
  let url;

  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

function NewFactForm({ setFacts, setShowForm }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const textLength = text.length;

    async function handleSubmit(e) {
    e.preventDefault();

    // 1. VALIDATIE: Controleer of alle velden zijn ingevuld én of de bron een geldige URL is
    if (!text || !category || !isValidHttpUrl(source) || text.length > 200) {
      alert("Please provide a valid fact (max 200 characters), a category, and a trustworthy HTTP/HTTPS URL source.");
      return; // Stop de functie direct als de data niet klopt
    }

    setIsUploading(true);
    
    try {
      const res = await fetch("/api/facts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text, source, category }),
      });

      const newFact = await res.json();

      // Voeg het nieuwe feitje toe aan de state zodat het live op het scherm verschijnt
      setFacts((facts) => [newFact, ...facts]);
      
      // Reset het formulier
      setText("");
      setSource("");
      setCategory("");
      setShowForm(false);
    } catch (err) {
      alert("Kon het feitje niet opslaan.");
    } finally {
      setIsUploading(false);
    }
  }


  return (
    <form className="fact-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Share a fact with the world..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={isUploading}
      />
      <span>{200 - textLength}</span>
      <input
        type="text"
        placeholder="Trustworthy source..."
        value={source}
        onChange={(e) => setSource(e.target.value)}
        disabled={isUploading}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        disabled={isUploading}
      >
        <option value="">Choose category:</option>
        {CATEGORIES.map((cat) => (
          <option key={cat.name} value={cat.name}>
            {cat.name.toUpperCase()}
          </option>
        ))}
      </select>
      <button className="btn btn-large" disabled={isUploading}>
        Post
      </button>
    </form>
  );
}

function CategoryFilter({ setCurrentCategory }) {
  return (
    <aside>
      <ul>
        <li className="category">
          <button
            className="btn btn-all-categories"
            onClick={() => setCurrentCategory("all")}
          >
            All
          </button>
        </li>
        {CATEGORIES.map((cat) => (
          <li key={cat.name} className="category">
            <button
              className="btn btn-category"
              style={{ backgroundColor: cat.color }}
              onClick={() => setCurrentCategory(cat.name)}
            >
              {cat.name}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function FactsList({ facts, setFacts }) {
  if (facts.length === 0)
    return (
      <p className="message">
        No facts for this category yet! Create the first one 👍
      </p>
    );
  return (
    <section>
      <ul className="facts-list">
        {facts.map((fact) => (
          <Fact key={fact.id} fact={fact} setFacts={setFacts} />
        ))}
      </ul>
      <p>There are {facts.length} facts in the database. Add you own!</p>
    </section>
  );
}

function Fact({ fact, setFacts }) {
  const [isUpdating, setIsUpdating] = useState(false);
  const isDisputed =
    fact.votesInteresting + fact.votesMindblowing < fact.votesFalse;

  async function handleVote(id, columnName) {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/facts/${id}/vote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ columnName }), // Dit stuurt de kolomnaam naar Express
      });

      const updatedFact = await res.json();

      // Update de state live in React
      setFacts((facts) => facts.map((f) => (f.id === id ? updatedFact : f)));
    } catch (err) {
      alert("Stemmen mislukt.");
    } finally {
      setIsUpdating(false);
    }
  }

  // Veilige check voor de categorie-kleur (voorkomt crashes)
  const categoryObject = CATEGORIES.find((cat) => cat.name === fact.category);
  const tagColor = categoryObject ? categoryObject.color : "#333";

  return (
    <li className="fact">
      <p>
        {isDisputed ? <span className="disputed">[⛔️DISPUTED]</span> : null}
        {fact.text}
        <a className="source" href={fact.source} target="_blank" rel="noreferrer">
          (source)
        </a>
      </p>
      <span
        className="tag"
        style={{ backgroundColor: tagColor }}
      >
        {fact.category}
      </span>
      <div className="vote-buttons">
        {/* We voegen hier fact.id toe als eerste parameter! */}
        <button
          onClick={() => handleVote(fact.id, "votesInteresting")}
          disabled={isUpdating}
        >
          👍 {fact.votesInteresting}
        </button>
        
        <button
          onClick={() => handleVote(fact.id, "votesMindblowing")}
          disabled={isUpdating}
        >
          🤯 {fact.votesMindblowing}
        </button>
        
        <button 
          onClick={() => handleVote(fact.id, "votesFalse")} 
          disabled={isUpdating}
        >
          ⛔️ {fact.votesFalse}
        </button>
      </div>
    </li>
  );
}


export default App;
