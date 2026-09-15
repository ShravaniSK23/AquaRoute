const RATES = {
    small: { whPerToken: 0.0003, mlWaterPerToken: 0.002 },
    large: { whPerToken: 0.006,  mlWaterPerToken: 0.04  }
  };
  
  function estimate(tier, totalTokens) {
    if (tier === "cached" || !totalTokens) {
      return { energyWh: 0, waterMl: 0, note: "Served from cache — no new computation" };
    }
    const rate = RATES[tier];
    return {
      energyWh: +(rate.whPerToken * totalTokens).toFixed(4),
      waterMl: +(rate.mlWaterPerToken * totalTokens).toFixed(4),
      note: "Estimated from published per-token intensity assumptions, applied to real Gemini token counts"
    };
  }
  
  module.exports = estimate;