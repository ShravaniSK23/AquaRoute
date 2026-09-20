/**
 * AquaRoute Structured Logger
 * Emits JSON structured log lines: { timestamp, requestId, stage, durationMs, ...meta }
 */

function logStage({ requestId, stage, durationMs, ...meta }) {
  const logObj = {
    timestamp: new Date().toISOString(),
    requestId: requestId || "system",
    stage,
    durationMs: durationMs !== undefined ? durationMs : null,
    ...meta
  };
  console.log(JSON.stringify(logObj));
}

function logError({ requestId, stage, error, code, durationMs }) {
  const logObj = {
    timestamp: new Date().toISOString(),
    requestId: requestId || "system",
    stage: stage || "error",
    error: error?.message || error || "Unknown error",
    code: code || error?.code || "ERROR",
    durationMs: durationMs !== undefined ? durationMs : null
  };
  console.error(JSON.stringify(logObj));
}

module.exports = {
  logStage,
  logError
};
