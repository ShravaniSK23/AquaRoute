const express = require("express");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const classify = require("../services/classify");
const callModel = require("../services/callModel");
const { checkCache, store } = require("../services/cache");
const estimate = require("../services/estimate");
const { estimateAlwaysLarge } = require("../services/estimate");
const validateRequest = require("../middleware/validateRequest");
const { logStage, logError } = require("../utils/logger");

// Express Rate Limit middleware for /generate endpoint (max 30 requests per minute)
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: "Too many requests. Please wait a moment before sending another prompt.",
      code: "RATE_LIMIT_EXCEEDED"
    });
  }
});

// In-memory store for pending requests prior to SSE stream connection
const pendingPipeline = new Map(); // requestId -> { prompt, noCache, createdAt }

// Cleanup stale pending requests older than 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [requestId, item] of pendingPipeline.entries()) {
    if (now - item.createdAt > 5 * 60 * 1000) {
      pendingPipeline.delete(requestId);
    }
  }
}, 60 * 1000);

// Helper function to execute the full pipeline for a prompt with structured logging
async function runPipeline({ prompt, noCache = false, requestId, emitStage }) {
  const startTime = Date.now();

  // 1. Received
  emitStage("received", { stage: "received", requestId, timestamp: Date.now() });
  logStage({ requestId, stage: "received" });

  // 2. Classified
  const classStart = Date.now();
  const classification = classify(prompt);
  const classDuration = Date.now() - classStart;
  emitStage("classified", {
    stage: "classified",
    requestId,
    tier: classification.tier,
    routingReason: classification.routingReason,
    signal: classification.signal,
    timestamp: Date.now()
  });
  logStage({
    requestId,
    stage: "classified",
    tier: classification.tier,
    durationMs: classDuration
  });

  // 3. Cache check (skipped if noCache is true)
  const cacheStart = Date.now();
  let cacheResult = { hit: false };
  
  if (!noCache) {
    cacheResult = await checkCache(prompt);
  }
  
  const cacheDuration = Date.now() - cacheStart;

  if (cacheResult.hit) {
    emitStage("cache_hit", {
      stage: "cache_hit",
      requestId,
      cached: true,
      cacheStatus: "HIT → 0 new computation",
      timestamp: Date.now()
    });
    logStage({
      requestId,
      stage: "cache_hit",
      durationMs: cacheDuration
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

    const totalDuration = Date.now() - startTime;
    emitStage("complete", {
      stage: "complete",
      requestId,
      data: finalData,
      timestamp: Date.now()
    });
    logStage({
      requestId,
      stage: "complete",
      cached: true,
      durationMs: totalDuration
    });

    return finalData;
  }

  emitStage("cache_miss", {
    stage: "cache_miss",
    requestId,
    cached: false,
    cacheStatus: noCache ? "DISABLED → COMPUTED" : "MISS → COMPUTED",
    timestamp: Date.now()
  });
  logStage({
    requestId,
    stage: "cache_miss",
    durationMs: cacheDuration
  });

  // 4. Model call start
  emitStage("model_call_start", {
    stage: "model_call_start",
    requestId,
    tier: classification.tier,
    timestamp: Date.now()
  });

  // 5. Call model
  const modelStart = Date.now();
  const result = await callModel(prompt, classification.tier);
  const modelDuration = Date.now() - modelStart;
  const totalTokens = result.usage?.totalTokenCount || 0;

  emitStage("model_call_done", {
    stage: "model_call_done",
    requestId,
    model: result.model,
    usage: result.usage,
    totalTokens,
    timestamp: Date.now()
  });
  logStage({
    requestId,
    stage: "model_call_done",
    model: result.model,
    tokens: totalTokens,
    durationMs: modelDuration
  });

  // 6. Estimate resources
  const estimateStart = Date.now();
  const resources = estimate(classification.tier, totalTokens);
  const alwaysLarge = estimateAlwaysLarge(totalTokens);
  const savedWaterMl = Math.max(0, alwaysLarge.waterMl - resources.waterMl);
  const savedPercent = alwaysLarge.waterMl > 0
    ? (savedWaterMl / alwaysLarge.waterMl) * 100
    : 0;
  const estimateDuration = Date.now() - estimateStart;

  emitStage("estimated", {
    stage: "estimated",
    requestId,
    resources,
    alwaysLarge,
    savedWaterMl: +savedWaterMl.toFixed(4),
    savedPercent: +savedPercent.toFixed(1),
    timestamp: Date.now()
  });
  logStage({
    requestId,
    stage: "estimated",
    waterMl: resources.waterMl,
    energyWh: resources.energyWh,
    durationMs: estimateDuration
  });

  // 7. Store in SQLite cache if cache is enabled
  if (!noCache && cacheResult.embedding) {
    store(cacheResult.embedding, result.text, prompt);
  }

  // 8. Complete
  const totalDuration = Date.now() - startTime;
  const finalData = {
    tier: classification.tier,
    model: result.model,
    response: result.text,
    usage: result.usage,
    resources,
    cached: false,
    cacheStatus: noCache ? "DISABLED → COMPUTED" : "MISS → COMPUTED",
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
  logStage({
    requestId,
    stage: "complete",
    cached: false,
    durationMs: totalDuration
  });

  return finalData;
}

// POST /generate/compare (Compare Mode: defined BEFORE /generate)
router.post("/generate/compare", generateLimiter, validateRequest, async (req, res, next) => {
  try {
    const { prompt } = req.body;
    const requestId = crypto.randomUUID();

    // Run both model tiers concurrently
    const [smallResult, largeResult] = await Promise.all([
      callModel(prompt, "small"),
      callModel(prompt, "large")
    ]);

    const smallTokens = smallResult.usage?.totalTokenCount || 0;
    const largeTokens = largeResult.usage?.totalTokenCount || 0;

    const smallResources = estimate("small", smallTokens);
    const largeResources = estimate("large", largeTokens);

    const savedWaterMl = Math.max(0, largeResources.waterMl - smallResources.waterMl);
    const savedPercent = largeResources.waterMl > 0
      ? (savedWaterMl / largeResources.waterMl) * 100
      : 0;

    res.json({
      requestId,
      prompt,
      savedWaterMl: +savedWaterMl.toFixed(4),
      savedPercent: +savedPercent.toFixed(1),
      small: {
        tier: "small",
        model: smallResult.model,
        response: smallResult.text,
        usage: smallResult.usage,
        resources: smallResources
      },
      large: {
        tier: "large",
        model: largeResult.model,
        response: largeResult.text,
        usage: largeResult.usage,
        resources: largeResources
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /generate endpoint
router.post("/generate", generateLimiter, validateRequest, async (req, res, next) => {
  try {
    const { prompt, noCache } = req.body;
    const requestId = crypto.randomUUID();

    if (req.query.direct === "true" || req.headers["x-direct-response"] === "true") {
      const finalData = await runPipeline({
        prompt,
        noCache: Boolean(noCache),
        requestId,
        emitStage: () => {}
      });
      return res.json(finalData);
    }

    pendingPipeline.set(requestId, { prompt, noCache: Boolean(noCache), createdAt: Date.now() });
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

  const { prompt, noCache } = pendingPipeline.get(requestId);
  pendingPipeline.delete(requestId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let isClosed = false;
  req.on("close", () => {
    isClosed = true;
  });

  const sendEvent = (eventName, payload) => {
    if (isClosed || res.writableEnded || res.destroyed) return;
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      // Connection closed by client
    }
  };

  try {
    await runPipeline({
      prompt,
      noCache,
      requestId,
      emitStage: sendEvent
    });
  } catch (err) {
    logError({ requestId, stage: "pipeline_error", error: err });
    if (!isClosed && !res.writableEnded && !res.destroyed) {
      sendEvent("error", {
        stage: "error",
        requestId,
        error: err.message || "Pipeline error",
        code: err.code || "PIPELINE_ERROR"
      });
    }
  } finally {
    if (!res.writableEnded && !res.destroyed) {
      try {
        res.end();
      } catch (e) {}
    }
  }
});

module.exports = router;
