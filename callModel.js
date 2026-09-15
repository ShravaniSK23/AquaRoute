require("dotenv").config();

const MODELS = {
  small: "gemini-3.5-flash-lite",
  large: "gemini-2.5-pro"
};

async function callModel(prompt, tier) {
  const model = MODELS[tier];

  if (!model) {
    throw new Error(`Invalid model tier: ${tier}`);
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

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

  if (!response.ok || !data.candidates) {
    console.error(
      "Gemini API error:",
      JSON.stringify(data, null, 2)
    );

    throw new Error(
      `Gemini API request failed: ${response.status}`
    );
  }

  return {
    text: data.candidates[0].content.parts[0].text,
    usage: data.usageMetadata,
    model
  };
}

module.exports = callModel;