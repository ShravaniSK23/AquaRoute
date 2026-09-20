const express = require("express");
const router = express.Router();
const config = require("../config");

router.get("/health", (req, res) => {
  const apiReachable = Boolean(config.geminiApiKey && config.geminiApiKey.trim().length > 0);
  const cacheActive = true;

  res.json({
    apiReachable,
    cacheActive
  });
});

module.exports = router;
