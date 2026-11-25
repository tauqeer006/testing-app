const express = require("express");
const { getSecondaryReadConnection } = require("../db");
const { getRates } = require("../providers");

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

// GET /api/products?minPrice=&currency= - List products from DB with optional filtering and currency conversion
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
    const rows = result.rows || [];

    // If no currency parameter requested, return raw DB records unchanged
    if (!req.query.currency) {
      return res.json(rows);
    }

    const targetCurrency = String(req.query.currency).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(targetCurrency)) {
      return res.status(400).json({ error: "Invalid currency parameter. Must be a 3-letter currency code." });
    }

    // Currency conversion requested: query third-party rates
    try {
      const ratesData = await getRates("USD");
      res.setHeader("X-Provider-Used", ratesData.provider);

      const rate = ratesData.rates[targetCurrency];
      if (rate === undefined) {
        const withError = rows.map((row) => ({
          ...row,
          conversionError: `Currency '${targetCurrency}' is not supported by active provider '${ratesData.provider}'`,
          provider: ratesData.provider,
        }));
        return res.json(withError);
      }

      const converted = rows.map((row) => {
        const rawPrice = row.PRICE !== undefined ? row.PRICE : row.price;
        const convertedPrice = Number((rawPrice * rate).toFixed(2));
        return {
          ...row,
          convertedPrice,
          currency: targetCurrency,
          rate,
          provider: ratesData.provider,
          stale: Boolean(ratesData.stale),
        };
      });

      return res.json(converted);
    } catch (ratesErr) {
      // If rates fail, return original prices plus a "conversionError" field, not a 500
      const fallback = rows.map((row) => ({
        ...row,
        conversionError: ratesErr.message,
      }));
      return res.json(fallback);
    }
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
