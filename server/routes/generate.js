const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const classify = require("../services/classify");
const callModel = require("../services/callModel");
const { checkCache, store } = require("../services/cache");
const estimate = require("../services/estimate");
const { estimateAlwaysLarge } = require("../services/estimate");
const validateRequest = require("../middleware/validateRequest");

// In-memory store for pending requests prior to SSE stream connection
const pendingPipeline = new Map(); // requestId -> { prompt, createdAt }

// Cleanup stale pending requests older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [requestId, item] of pendingPipeline.entries()) {
    if (now - item.createdAt > 5 * 60 * 1000) {
      pendingPipeline.delete(requestId);
    }
  }
}, 60 * 1000);

// Helper function to execute the full pipeline for a prompt
async function runPipeline({ prompt, requestId, emitStage }) {
  // 1. Received
  emitStage("received", { stage: "received", requestId, timestamp: Date.now() });

  // 2. Classified
  const classification = classify(prompt);
  emitStage("classified", {
    stage: "classified",
    requestId,
    tier: classification.tier,
    routingReason: classification.routingReason,
    signal: classification.signal,
    timestamp: Date.now()
  });

  // 3. Cache check
  const cacheResult = await checkCache(prompt);

  if (cacheResult.hit) {
    emitStage("cache_hit", {
      stage: "cache_hit",
      requestId,
      cached: true,
      cacheStatus: "HIT → 0 new computation",
      timestamp: Date.now()
    });

    const finalData = {
      tier: "cached",
      model: null,
      response: cacheResult.response,
      usage: null,
      resources: {
        energyWh: 0,
        waterMl: 0,
        tokens: 0,
        note: "Served from cache — no new computation"
      },
      cached: true,
      cacheStatus: "HIT → 0 new computation",
      alwaysLarge: { energyWh: 0, waterMl: 0, tokens: 0 },
      savedWaterMl: 0,
      savedPercent: 0,
      routingReason: classification.routingReason,
      signal: classification.signal,
      requestId
    };

    emitStage("complete", {
      stage: "complete",
      requestId,
      data: finalData,
      timestamp: Date.now()
    });

    return finalData;
  }

  emitStage("cache_miss", {
    stage: "cache_miss",
    requestId,
    cached: false,
    cacheStatus: "MISS → COMPUTED",
    timestamp: Date.now()
  });

  // 4. Model call start
  emitStage("model_call_start", {
    stage: "model_call_start",
    requestId,
    tier: classification.tier,
    timestamp: Date.now()
  });

  // 5. Call model
  const result = await callModel(prompt, classification.tier);
  const totalTokens = result.usage?.totalTokenCount || 0;

  emitStage("model_call_done", {
    stage: "model_call_done",
    requestId,
    model: result.model,
    usage: result.usage,
    totalTokens,
    timestamp: Date.now()
  });

  // 6. Estimate resources
  const resources = estimate(classification.tier, totalTokens);
  const alwaysLarge = estimateAlwaysLarge(totalTokens);
  const savedWaterMl = Math.max(0, alwaysLarge.waterMl - resources.waterMl);
  const savedPercent = alwaysLarge.waterMl > 0
    ? (savedWaterMl / alwaysLarge.waterMl) * 100
    : 0;

  emitStage("estimated", {
    stage: "estimated",
    requestId,
    resources,
    alwaysLarge,
    savedWaterMl: +savedWaterMl.toFixed(4),
    savedPercent: +savedPercent.toFixed(1),
    timestamp: Date.now()
  });

  // 7. Store in cache
  store(cacheResult.embedding, result.text);

  // 8. Complete
  const finalData = {
    tier: classification.tier,
    model: result.model,
    response: result.text,
    usage: result.usage,
    resources,
    cached: false,
    cacheStatus: "MISS → COMPUTED",
    alwaysLarge,
    savedWaterMl: +savedWaterMl.toFixed(4),
    savedPercent: +savedPercent.toFixed(1),
    routingReason: classification.routingReason,
    signal: classification.signal,
    requestId
  };

  emitStage("complete", {
    stage: "complete",
    requestId,
    data: finalData,
    timestamp: Date.now()
  });

  return finalData;
}

// POST /generate endpoint
router.post("/generate", validateRequest, async (req, res, next) => {
  try {
    const { prompt } = req.body;
    const requestId = crypto.randomUUID();

    // If client explicitly requests direct JSON response without SSE
    if (req.query.direct === "true" || req.headers["x-direct-response"] === "true") {
      const finalData = await runPipeline({
        prompt,
        requestId,
        emitStage: () => {}
      });
      return res.json(finalData);
    }

    // Save prompt to pending map for SSE consumption
    pendingPipeline.set(requestId, { prompt, createdAt: Date.now() });

    res.json({ requestId });
  } catch (err) {
    next(err);
  }
});

// GET /generate/stream SSE endpoint
router.get("/generate/stream", async (req, res) => {
  const requestId = req.query.id;

  if (!requestId || !pendingPipeline.has(requestId)) {
    return res.status(404).json({
      error: "Invalid or expired requestId",
      code: "INVALID_REQUEST_ID"
    });
  }

  const { prompt } = pendingPipeline.get(requestId);
  pendingPipeline.delete(requestId);

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (eventName, payload) => {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    await runPipeline({
      prompt,
      requestId,
      emitStage: sendEvent
    });
  } catch (err) {
    console.error(`[SSE Error] ${err.message}`);
    sendEvent("error", {
      stage: "error",
      requestId,
      error: err.message || "Pipeline error",
      code: err.code || "PIPELINE_ERROR"
    });
  } finally {
    res.end();
  }
});

module.exports = router;
