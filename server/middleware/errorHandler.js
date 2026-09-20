function errorHandler(err, req, res, next) {
  console.error(`[Error] ${err.stack || err.message || err}`);

  const status = err.status || err.statusCode || 500;
  const code = err.code || "INTERNAL_ERROR";
  const error = err.message || "An unexpected error occurred.";

  // Never return raw stack trace to the client
  res.status(status).json({
    error,
    code
  });
}

module.exports = errorHandler;
