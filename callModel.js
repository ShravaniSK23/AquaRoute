require("dotenv").config();

const MODELS = {
  small: "gemini-3.5-flash-lite",
  large: "gemini-3.5-flash"
};

// Wait helper
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Errors that are temporary and worth retrying
const RETRYABLE_STATUS_CODES = [
  408, // Request Timeout
  429, // Too Many Requests / Rate Limit
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504  // Gateway Timeout
];

async function callModel(prompt, tier) {

  const model = MODELS[tier];

  if (!model) {
    throw new Error(`Invalid model tier: ${tier}`);
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  // Maximum number of retries AFTER the first attempt
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {

    try {

      console.log(
        `Calling Gemini ${model} | Attempt ${attempt + 1}/${maxRetries + 1}`
      );

      const response = await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ]
        })
      });

      const data = await response.json();

      // ----------------------------------------
      // SUCCESS
      // ----------------------------------------

      if (response.ok && data.candidates?.length > 0) {

        console.log(`Gemini ${model} responded successfully.`);

        return {
          text: data.candidates[0].content.parts[0].text,
          usage: data.usageMetadata,
          model
        };
      }

      // ----------------------------------------
      // ERROR
      // ----------------------------------------

      const status = response.status;

      console.error(
        `Gemini API error ${status}:`,
        data?.error?.message || "Unknown error"
      );

      // If this error is NOT temporary,
      // don't waste time retrying it.
      if (!RETRYABLE_STATUS_CODES.includes(status)) {

        throw new Error(
          `Gemini API request failed: ${status} - ` +
          `${data?.error?.message || "Unknown error"}`
        );
      }

      // ----------------------------------------
      // RETRY
      // ----------------------------------------

      if (attempt < maxRetries) {

        // Exponential backoff:
        // attempt 0 -> 1 second
        // attempt 1 -> 2 seconds
        // attempt 2 -> 4 seconds

        const baseDelay = 1000 * Math.pow(2, attempt);

        // Random jitter between 0-500 ms
        const jitter = Math.floor(Math.random() * 500);

        const delay = baseDelay + jitter;

        console.log(
          `Temporary Gemini error (${status}). ` +
          `Retrying in ${(delay / 1000).toFixed(1)} seconds...`
        );

        await sleep(delay);

      } else {

        // ----------------------------------------
        // ALL RETRIES FAILED
        // ----------------------------------------

        console.error(
          `Gemini ${model} failed after ${maxRetries + 1} attempts.`
        );

        throw new Error(
          `Gemini is temporarily unavailable (${status}). ` +
          `Please try again in a moment.`
        );
      }

    } catch (error) {

      // ----------------------------------------
      // NETWORK / FETCH ERROR
      // ----------------------------------------

      // If this was already our final API error,
      // don't retry it again.
      if (
        error.message.startsWith("Gemini API request failed") ||
        error.message.startsWith("Gemini is temporarily unavailable")
      ) {
        throw error;
      }

      console.error(
        "Network error while contacting Gemini:",
        error.message
      );

      // Retry network failures too
      if (attempt < maxRetries) {

        const baseDelay = 1000 * Math.pow(2, attempt);
        const jitter = Math.floor(Math.random() * 500);
        const delay = baseDelay + jitter;

        console.log(
          `Network problem. Retrying in ` +
          `${(delay / 1000).toFixed(1)} seconds...`
        );

        await sleep(delay);

      } else {

        throw new Error(
          "Could not connect to Gemini after multiple attempts. " +
          "Please try again."
        );
      }
    }
  }
}

module.exports = callModel;