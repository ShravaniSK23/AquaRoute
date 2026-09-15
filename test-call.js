const classify = require("./classify");
const callModel = require("./callModel");

async function run() {
  const prompt = "What's the capital of France?";

  const tier = classify(prompt);

  const result = await callModel(prompt, tier);

  console.log(`Tier used: ${tier}`);
  console.log(`Model used: ${result.model}`);
  console.log(`Answer: ${result.text}`);
  console.log("Usage:", result.usage);
}

run();