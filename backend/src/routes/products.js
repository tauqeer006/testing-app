const express = require("express");
const { getSecondaryReadConnection } = require("../db");

const router = express.Router();

function getOraCode(err) {
  if (err.errorNum) {
    return `ORA-${String(err.errorNum).padStart(5, "0")}`;
  }
  const match = err.message && err.message.match(/ORA-\d+/);
  if (match) return match[0];
  if (err.code) return String(err.code);
  return "ORA-UNKNOWN";
}

async function setServedByHeader(connection, res) {
  try {
    const identityResult = await connection.execute("SELECT name FROM db_identity");
    const row = identityResult.rows && identityResult.rows[0];
    const name = row ? (row.NAME || row.name || "UNKNOWN") : "UNKNOWN";
    res.setHeader("X-DB-Served-By", name);
  } catch (err) {
    res.setHeader("X-DB-Served-By", "ERROR");
  }
}

// GET /api/products?minPrice= - List products, optionally filtered by minPrice (READ pool)
router.get("/products", async (req, res) => {
  let connection;
  try {
    connection = await getSecondaryReadConnection();
    let result;

    if (req.query.minPrice !== undefined && req.query.minPrice !== "") {
      const minPrice = parseFloat(req.query.minPrice);
      if (isNaN(minPrice)) {
        return res.status(400).json({ error: "Invalid minPrice query parameter" });
      }

      result = await connection.execute(
        "SELECT id, name, price FROM products WHERE price >= :minPrice ORDER BY price ASC",
        { minPrice }
      );
    } else {
      result = await connection.execute(
        "SELECT id, name, price FROM products ORDER BY price ASC"
      );
    }

    await setServedByHeader(connection, res);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to retrieve products",
      code: getOraCode(err),
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("Error closing read connection:", closeErr);
      }
    }
  }
});

module.exports = router;
