require("dotenv").config();
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

// Ensure data directory exists
const dataDir = path.join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite database
const dbPath = path.join(dataDir, "cache.sqlite");
const db = new Database(dbPath);

// Create cache table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt TEXT,
    embedding TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
`);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Retryable status codes for embedding API calls
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

async function getEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: { parts: [{ text }] } })
      });

      const data = await response.json();

      if (response.ok && data.embedding?.values) {
        return data.embedding.values;
      }

      const status = response.status;
      if (!RETRYABLE_STATUS_CODES.includes(status) || attempt === maxRetries) {
        console.error("Embedding error:", data);
        throw new Error(`Embedding request failed with status ${status}`);
      }

      const delay = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
      await sleep(delay);
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 300);
      await sleep(delay);
    }
  }
}

function cosineSim(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB);
}

async function checkCache(prompt, threshold = 0.90) {
  const embedding = await getEmbedding(prompt);

  // Retrieve stored entries from SQLite
  const stmt = db.prepare("SELECT prompt, embedding, response FROM cache");
  const rows = stmt.all();

  for (const row of rows) {
    try {
      const storedEmbedding = JSON.parse(row.embedding);
      const similarity = cosineSim(embedding, storedEmbedding);

      console.log(
        `[SQLite Cache] Similarity: ${similarity.toFixed(4)} | Threshold: ${threshold}`
      );

      if (similarity > threshold) {
        return {
          hit: true,
          response: row.response,
          embedding
        };
      }
    } catch (err) {
      console.error("[SQLite Cache Parse Error]", err);
    }
  }

  return {
    hit: false,
    embedding
  };
}

function store(embedding, response, promptText = "") {
  try {
    const stmt = db.prepare(
      "INSERT INTO cache (prompt, embedding, response, created_at) VALUES (?, ?, ?, ?)"
    );
    stmt.run(promptText, JSON.stringify(embedding), response, Date.now());
  } catch (err) {
    console.error("[SQLite Cache Store Error]", err);
  }
}

module.exports = { checkCache, store, db };
