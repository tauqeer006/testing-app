const express = require("express");

const router = express.Router();

// GET /health - Must NOT touch the database
router.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

module.exports = router;
