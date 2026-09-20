function classify(prompt) {
  const text = prompt.toLowerCase();

  const complexSignals = [
    "design",
    "architecture",
    "prove",
    "analyze",
    "analysis",
    "strategy",
    "distributed",
    "explain why",
    "compare and contrast",
    "draft a response",

    // Coding / technical reasoning
    "write a program",
    "write a function",
    "implement",
    "debug",
    "code",
    "algorithm",
    "time complexity",
    "space complexity",

    // Multi-step / deeper reasoning
    "step by step",
    "solve",
    "derive",
    "evaluate",
    "optimize",
    "why does",
    "how does",
    "explain how"
  ];

  const words = prompt.trim().split(/\s+/);
  const isLong = words.length > 25;
  const matchedSignal = complexSignals.find(signal => text.includes(signal));
  const isComplex = isLong || Boolean(matchedSignal);
  const tier = isComplex ? "large" : "small";

  let signal = "";
  let routingReason = "";

  if (isLong && matchedSignal) {
    signal = `Length (${words.length} words) + Keyword ("${matchedSignal}")`;
    routingReason = `Prompt length exceeds 25 words (${words.length} words) and contains complex reasoning keyword "${matchedSignal}"`;
  } else if (isLong) {
    signal = `Prompt length (${words.length} words > 25)`;
    routingReason = `Prompt length exceeds 25 words (${words.length} words); routed to large model`;
  } else if (matchedSignal) {
    signal = `Keyword signal ("${matchedSignal}")`;
    routingReason = `Matched complex reasoning keyword "${matchedSignal}"; routed to large model`;
  } else {
    signal = `Simple prompt (${words.length} words)`;
    routingReason = `Short prompt (${words.length} words) without complex keywords; routed to small model`;
  }

  const result = {
    tier,
    routingReason,
    signal
  };

  result.toString = () => tier;

  return result;
}

module.exports = classify;
