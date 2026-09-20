function validateRequest(req, res, next) {
  const { prompt } = req.body || {};

  if (prompt === undefined || prompt === null || typeof prompt !== "string") {
    return res.status(400).json({
      error: "Prompt is required and must be a string.",
      code: "INVALID_PROMPT"
    });
  }

  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return res.status(400).json({
      error: "Prompt cannot be empty.",
      code: "EMPTY_PROMPT"
    });
  }

  if (prompt.length > 2000) {
    return res.status(400).json({
      error: "Prompt exceeds maximum allowed length of 2000 characters.",
      code: "PROMPT_TOO_LONG"
    });
  }

  next();
}

module.exports = validateRequest;
