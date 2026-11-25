require("dotenv").config();
const express = require("express");
const cors = require("cors");

const usersRouter = require("./routes/users");
const ordersRouter = require("./routes/orders");
const productsRouter = require("./routes/products");
const statsRouter = require("./routes/stats");
const auditRouter = require("./routes/audit");
const healthRouter = require("./routes/health");
const debugRouter = require("./routes/debug");
const ratesRouter = require("./routes/rates");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global process error handlers to ensure the process never crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception thrown:", err);
});

// Routes
// Utility: Health check (does not touch database or any provider)
app.use("/", healthRouter);
app.use("/api", healthRouter);

// Utility: Database & Provider debug checks
app.use("/debug", debugRouter);

// Core API endpoints
app.use("/api", usersRouter);
app.use("/api", ordersRouter);
app.use("/api", productsRouter);
app.use("/api", statsRouter);
app.use("/api", auditRouter);
app.use("/api", ratesRouter);

// 404 handler for unmapped endpoints
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Generic error handling middleware
app.use((err, req, res, next) => {
  console.error("Global express error:", err);
  res.status(500).json({
    error: err.message || "Internal Server Error",
    code: err.code || "ERR_INTERNAL",
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend server successfully started on port ${PORT}`);
  });
}

module.exports = app;
