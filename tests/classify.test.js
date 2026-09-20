const test = require("node:test");
const assert = require("node:assert/strict");
const classify = require("../server/services/classify");

test("classify() — simple short prompt routes to small tier", () => {
  const result = classify("What is the capital of France?");
  assert.equal(result.tier, "small");
  assert.equal(String(result), "small");
  assert.ok(result.signal.includes("Simple prompt"));
});

test("classify() — prompt with complex reasoning keyword routes to large tier", () => {
  const keywords = ["design", "architecture", "implement", "debug", "explain how"];
  keywords.forEach((kw) => {
    const res = classify(`Please ${kw} a caching strategy.`);
    assert.equal(res.tier, "large");
    assert.ok(res.signal.includes("Keyword signal"));
  });
});

test("classify() — prompt with > 25 words routes to large tier", () => {
  const longPrompt = "Can you please tell me all the details about the history of computing starting from the early analytical engines all the way to modern day microprocessors and cloud datacenters?";
  const result = classify(longPrompt);
  assert.equal(result.tier, "large");
  assert.ok(result.signal.includes("> 25"));
});

test("classify() — returns classification object with routingReason and signal", () => {
  const result = classify("Analyze quantum computing algorithms.");
  assert.equal(typeof result, "object");
  assert.equal(result.tier, "large");
  assert.equal(typeof result.routingReason, "string");
  assert.equal(typeof result.signal, "string");
});
