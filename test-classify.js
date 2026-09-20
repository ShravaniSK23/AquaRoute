const classify = require("./server/services/classify");

const testPrompts = [

  "What's 12 times 8?",

  "Design a distributed system that handles millions of users.",

  "What are your working hours?",

  "Draft a response to this complex, emotionally charged complaint."

];

testPrompts.forEach(p => {

  console.log(`"${p}" → ${classify(p)}`);

});
