require("dotenv").config();

function validateConfig() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    console.error("=================================================");
    console.error("FATAL CONFIG ERROR: GEMINI_API_KEY is missing!");
    console.error("Please set GEMINI_API_KEY in your .env file.");
    console.error("=================================================");
    process.exit(1);
  }
}

module.exports = {
  port: process.env.PORT || 3000,
  geminiApiKey: process.env.GEMINI_API_KEY,
  validateConfig
};
