function classify(prompt) {

  const text = prompt.toLowerCase();

  const complexSignals = [

    "design", "architecture", "prove", "analyze", "strategy",

    "distributed", "explain why", "compare and contrast", "draft a response"

  ];

  const isLong = prompt.split(" ").length > 25;

  const hasComplexSignal = complexSignals.some(sig => text.includes(sig));

  return (isLong || hasComplexSignal) ? "large" : "small";

}

module.exports = classify;
