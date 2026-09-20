const test = require("node:test");
const assert = require("node:assert/strict");
const estimate = require("../server/services/estimate");
const { estimateAlwaysLarge } = require("../server/services/estimate");

test("estimate() — calculates resource impact for small tier", () => {
  const result = estimate("small", 1000);
  assert.equal(result.energyWh, 0.3);
  assert.equal(result.waterMl, 2.0);
  assert.equal(result.tokens, 1000);
});

test("estimate() — calculates resource impact for large tier", () => {
  const result = estimate("large", 1000);
  assert.equal(result.energyWh, 6.0);
  assert.equal(result.waterMl, 40.0);
  assert.equal(result.tokens, 1000);
});

test("estimate() — returns zero usage for cached requests", () => {
  const result = estimate("cached", 1000);
  assert.equal(result.energyWh, 0);
  assert.equal(result.waterMl, 0);
  assert.ok(result.note.includes("cache"));
});

test("estimateAlwaysLarge() — calculates hypothetical baseline", () => {
  const result = estimateAlwaysLarge(500);
  assert.equal(result.energyWh, 3.0);
  assert.equal(result.waterMl, 20.0);
  assert.equal(result.tokens, 500);
});

test("estimate() — throws error on invalid tier", () => {
  assert.throws(() => {
    estimate("unknown_tier", 100);
  }, /Unknown tier/);
});
