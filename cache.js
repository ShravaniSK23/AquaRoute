require("dotenv").config();
const cacheStore = []; // { embedding, response }

async function getEmbedding(text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: { parts: [{ text }] } })
  });
  const data = await response.json();
  if (!response.ok) {
    console.error("Embedding error:", data);
    throw new Error("Embedding request failed");
  }
  return data.embedding.values;
}

function cosineSim(a, b) {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB);
}

async function checkCache(prompt, threshold = 0.90) {
    const embedding = await getEmbedding(prompt);
  
    for (const entry of cacheStore) {
      const similarity = cosineSim(embedding, entry.embedding);
  
      console.log(
        `Similarity: ${similarity.toFixed(4)} | Threshold: ${threshold}`
      );
  
      if (similarity > threshold) {
        return {
          hit: true,
          response: entry.response,
          embedding
        };
      }
    }
  
    return {
      hit: false,
      embedding
    };
  }

function store(embedding, response) {
  cacheStore.push({ embedding, response });
}

module.exports = { checkCache, store };