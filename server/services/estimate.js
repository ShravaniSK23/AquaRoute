const RATES = {
  small: {
    whPerToken: 0.0003,
    mlWaterPerToken: 0.002
  },

  large: {
    whPerToken: 0.006,
    mlWaterPerToken: 0.04
  }
};


function estimate(tier, totalTokens) {

  if (tier === "cached" || !totalTokens) {
    return {
      energyWh: 0,
      waterMl: 0,
      note: "Served from cache — no new computation"
    };
  }

  const rate = RATES[tier];

  if (!rate) {
    throw new Error(`Unknown tier: ${tier}`);
  }

  return {
    energyWh: +(rate.whPerToken * totalTokens).toFixed(4),

    waterMl: +(rate.mlWaterPerToken * totalTokens).toFixed(4),

    tokens: totalTokens,

    note:
      "Estimated from published per-token intensity assumptions, applied to real Gemini token counts"
  };
}


/*
 * Estimate what the same request would consume
 * if it had been routed to the large model.
 *
 * We use the SAME token count from the actual response,
 * so we don't need to make a second Gemini API call.
 */
function estimateAlwaysLarge(totalTokens) {

  if (!totalTokens) {
    return {
      energyWh: 0,
      waterMl: 0,
      tokens: 0
    };
  }

  const rate = RATES.large;

  return {
    energyWh: +(rate.whPerToken * totalTokens).toFixed(4),

    waterMl: +(rate.mlWaterPerToken * totalTokens).toFixed(4),

    tokens: totalTokens
  };
}


module.exports = estimate;
module.exports.estimateAlwaysLarge = estimateAlwaysLarge;
