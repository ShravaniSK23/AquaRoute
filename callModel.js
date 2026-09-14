require("dotenv").config();

async function callModel(prompt, tier) {

  const model =
    tier === "small"
      ? "gemini-3.5-flash-lite"   // fast/cheap tier
      : "gemini-2.5-pro";          // powerful tier

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }]
        }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini API Error:");
    console.error(data);
    throw new Error(`Gemini API request failed: ${response.status}`);
  }

  return data.candidates[0].content.parts[0].text;
}

module.exports = callModel;