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

  const baselineResults = {};

  for (const p of prompts) {

    console.log("\n========================================");
    console.log(`PROMPT: ${p.text}`);

    // ----------------------------------------
    // AquaRoute
    // ----------------------------------------

    const tier = classify(p.text);

    console.log(`AquaRoute selected: ${tier}`);

    const routedResult = await callModel(p.text, tier);

    const routedEst = estimate(
      tier,
      routedResult.usage?.totalTokenCount
    );

    routedWater += routedEst.waterMl;
    routedEnergy += routedEst.energyWh;

    console.log(
      `AquaRoute tokens: ${routedResult.usage?.totalTokenCount}`
    );

    console.log(
      `AquaRoute water: ${routedEst.waterMl} mL`
    );

    await wait(1500);

    // ----------------------------------------
    // Baseline: always large
    // ----------------------------------------

    console.log("Running always-large baseline...");

    const baselineResult = await callModel(p.text, "large");

    const baselineEst = estimate(
      "large",
      baselineResult.usage?.totalTokenCount
    );

    baselineWater += baselineEst.waterMl;
    baselineEnergy += baselineEst.energyWh;

    console.log(
      `Baseline tokens: ${baselineResult.usage?.totalTokenCount}`
    );

    console.log(
      `Baseline water: ${baselineEst.waterMl} mL`
    );

    // Save measured baseline for frontend
    baselineResults[p.text] = {
      waterMl: baselineEst.waterMl,
      energyWh: baselineEst.energyWh,
      tokens: baselineResult.usage?.totalTokenCount
    };

    await wait(1500);
  }

  // ----------------------------------------
  // Final totals
  // ----------------------------------------

  console.log("\n\n========================================");
  console.log("FINAL EXPERIMENT RESULTS");
  console.log("========================================");

  console.log(
    `AquaRoute: ${routedWater.toFixed(2)} mL water, ` +
    `${routedEnergy.toFixed(2)} Wh`
  );

  console.log(
    `Baseline (always large): ${baselineWater.toFixed(2)} mL water, ` +
    `${baselineEnergy.toFixed(2)} Wh`
  );

  console.log(
    `Savings: ${(100 - (routedWater / baselineWater) * 100).toFixed(1)}%`
  );

  console.log("\n\nBASELINE DATA FOR FRONTEND:");
  console.log(JSON.stringify(baselineResults, null, 2));
}

run();