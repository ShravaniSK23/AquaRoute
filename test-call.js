const classify = require("./classify");

const callModel = require("./callModel");

async function run() {

//   const prompt = "What's 12 times 8?";
  const prompt = "What's the capital of France?";

  const tier = classify(prompt);

  const answer = await callModel(prompt, tier);

  console.log(`Tier used: ${tier}`);

  console.log(`Answer: ${answer}`);

}

run();
