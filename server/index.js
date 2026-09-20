require("dotenv").config();
const express = require("express");
const path = require("path");
const helmet = require("helmet");

const config = require("./config");
const generateRouter = require("./routes/generate");
const healthRouter = require("./routes/health");
const errorHandler = require("./middleware/errorHandler");

// 1. Fail-fast config validation on startup
config.validateConfig();

const app = express();

// 2. Security headers via Helmet (disabling CSP and HSTS so local HTTP works seamlessly without browser forcing HTTPS)
app.use(helmet({ contentSecurityPolicy: false, hsts: false }));

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// 3. Mount routes
app.use(healthRouter);
app.use(generateRouter);

// 4. Centralized error handling middleware
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`AquaRoute server running on port ${config.port}`);
});

// Prevent unhandled errors or rejections from crashing the process
process.on("uncaughtException", (err) => {
  console.error("[Process Uncaught Exception]", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[Process Unhandled Rejection]", reason);
});

module.exports = app;
