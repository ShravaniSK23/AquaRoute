require("dotenv").config();
const express = require("express");
const path = require("path");

const config = require("./config");
const generateRouter = require("./routes/generate");
const healthRouter = require("./routes/health");
const errorHandler = require("./middleware/errorHandler");

// 1. Fail-fast config validation on startup
config.validateConfig();

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 2. Mount routes
app.use(healthRouter);
app.use(generateRouter);

// 3. Centralized error handling middleware
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`AquaRoute server running on port ${config.port}`);
});

module.exports = app;
