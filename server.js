require("dotenv").config();

const express = require("express");
const classify = require("./classify");
const callModel = require("./callModel");
const { checkCache, store } = require("./cache");

const app = express();

app.use(express.json());

app.post("/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    // 1. Check semantic cache first
    const cacheResult = await checkCache(prompt);

    if (cacheResult.hit) {
      return res.json({
        tier: "cached",
        model: null,
        response: cacheResult.response,
        usage: null,
        cached: true
      });
    }

    // 2. If not cached, classify the prompt
    const tier = classify(prompt);

    // 3. Call the appropriate Gemini model
    const result = await callModel(prompt, tier);

    // 4. Store the response in cache
    store(cacheResult.embedding, result.text);

    // 5. Return the response
    res.json({
      tier,
      model: result.model,
      response: result.text,
      usage: result.usage,
      cached: false
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});

app.listen(3000, () => {
  console.log("AquaRoute running on :3000");
});