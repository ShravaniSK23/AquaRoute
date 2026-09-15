require("dotenv").config();

const prompts = require("./experiments/prompts.json");
const classify = require("./classify");
const callModel = require("./callModel");
const estimate = require("./estimate");

const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  let routedWater = 0;
  let routedEnergy = 0;

  let baselineWater = 0;
  let baselineEnergy = 0;

  for (const p of prompts) {

    // AquaRoute
    const tier = classify(p.text);

    const routedResult = await callModel(p.text, tier);

    const routedEst = estimate(
      tier,
      routedResult.usage?.totalTokenCount
    );

    routedWater += routedEst.waterMl;
    routedEnergy += routedEst.energyWh;

    await wait(1500); // free-tier rate limit buffer


    // Baseline: always use large model
    const baselineResult = await callModel(p.text, "large");

    const baselineEst = estimate(
      "large",
      baselineResult.usage?.totalTokenCount
    );

    baselineWater += baselineEst.waterMl;
    baselineEnergy += baselineEst.energyWh;

    await wait(1500); // free-tier rate limit buffer
  }

  console.log(
    `AquaRoute: ${routedWater.toFixed(2)} mL water, ${routedEnergy.toFixed(2)} Wh`
  );

  console.log(
    `Baseline (always large): ${baselineWater.toFixed(2)} mL water, ${baselineEnergy.toFixed(2)} Wh`
  );

  console.log(
    `Savings: ${(100 - (routedWater / baselineWater) * 100).toFixed(1)}%`
  );
}

run();