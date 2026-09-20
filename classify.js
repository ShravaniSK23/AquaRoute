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

  const isLong = prompt.split(/\s+/).length > 25;

  const hasComplexSignal =
    complexSignals.some(signal => text.includes(signal));

  return (isLong || hasComplexSignal)
    ? "large"
    : "small";
}

module.exports = classify;