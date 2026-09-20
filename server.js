require("dotenv").config();

const express = require("express");

const classify = require("./classify");
const callModel = require("./callModel");

const {
  checkCache,
  store
} = require("./cache");

const estimate = require("./estimate");

const {
  estimateAlwaysLarge
} = require("./estimate");


const app = express();

app.use(express.json());
app.use(express.static("public"));


app.post("/generate", async (req, res) => {

  try {

    const { prompt } = req.body;


    // ---------------------------------------------
    // Validate prompt
    // ---------------------------------------------

    if (!prompt || typeof prompt !== "string") {

      return res.status(400).json({
        error: "Prompt is required"
      });

    }


    // ---------------------------------------------
    // 1. Check semantic cache
    // ---------------------------------------------

    const cacheResult =
      await checkCache(prompt);


    // ---------------------------------------------
    // CACHE HIT
    // ---------------------------------------------

    if (cacheResult.hit) {

      return res.json({

        tier: "cached",

        model: null,

        response: cacheResult.response,

        usage: null,

        resources: {
          energyWh: 0,
          waterMl: 0,
          tokens: 0,
          note:
            "Served from cache — no new computation"
        },

        // No new AquaRoute computation
        cached: true,

        // Baseline is also zero for this new request
        alwaysLarge: {
          energyWh: 0,
          waterMl: 0,
          tokens: 0
        },

        savedWaterMl: 0,

        savedPercent: 0

      });

    }


    // ---------------------------------------------
    // 2. Classify prompt
    // ---------------------------------------------

    const tier =
      classify(prompt);


    console.log(
      `AquaRoute routing → ${tier}`
    );


    // ---------------------------------------------
    // 3. Call selected Gemini model
    // ---------------------------------------------

    const result =
      await callModel(
        prompt,
        tier
      );


    // ---------------------------------------------
    // 4. Get actual token count
    // ---------------------------------------------

    const totalTokens =
      result.usage?.totalTokenCount || 0;


    // ---------------------------------------------
    // 5. Calculate actual AquaRoute usage
    // ---------------------------------------------

    const resources =
      estimate(
        tier,
        totalTokens
      );


    // ---------------------------------------------
    // 6. Calculate hypothetical
    //    always-large usage
    // ---------------------------------------------

    const alwaysLarge =
      estimateAlwaysLarge(
        totalTokens
      );


    // ---------------------------------------------
    // 7. Calculate water saved
    // ---------------------------------------------

    const savedWaterMl =
      Math.max(
        0,
        alwaysLarge.waterMl -
        resources.waterMl
      );


    const savedPercent =
      alwaysLarge.waterMl > 0

        ? (
            savedWaterMl /
            alwaysLarge.waterMl
          ) * 100

        : 0;


    // ---------------------------------------------
    // 8. Store response in semantic cache
    // ---------------------------------------------

    store(
      cacheResult.embedding,
      result.text
    );


    // ---------------------------------------------
    // 9. Return everything to frontend
    // ---------------------------------------------

    res.json({

      tier,

      model: result.model,

      response: result.text,

      usage: result.usage,

      resources,

      cached: false,

      alwaysLarge,

      savedWaterMl:
        +savedWaterMl.toFixed(4),

      savedPercent:
        +savedPercent.toFixed(1)

    });


  } catch (err) {

    console.error(err);


    res.status(500).json({

      error: err.message

    });

  }

});


app.listen(3000, () => {

  console.log(
    "AquaRoute running on :3000"
  );

});