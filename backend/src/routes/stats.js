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

// GET /api/stats/summary - Summary aggregates (READ pool)
router.get("/stats/summary", async (req, res) => {
  let connection;
  try {
    connection = await getSecondaryReadConnection();
    const result = await connection.execute(
      `SELECT 
        (SELECT COUNT(*) FROM users) AS user_count,
        (SELECT COUNT(*) FROM orders) AS order_count,
        (SELECT COUNT(*) FROM products) AS product_count,
        (SELECT NVL(SUM(total), 0) FROM orders) AS total_revenue,
        (SELECT NVL(ROUND(AVG(total), 2), 0) FROM orders) AS avg_order_value
       FROM DUAL`
    );

    await setServedByHeader(connection, res);

    const row = result.rows && result.rows[0];
    const summary = {
      userCount: row ? (row.USER_COUNT !== undefined ? row.USER_COUNT : row.user_count) : 0,
      orderCount: row ? (row.ORDER_COUNT !== undefined ? row.ORDER_COUNT : row.order_count) : 0,
      productCount: row ? (row.PRODUCT_COUNT !== undefined ? row.PRODUCT_COUNT : row.product_count) : 0,
      totalRevenue: row ? (row.TOTAL_REVENUE !== undefined ? row.TOTAL_REVENUE : row.total_revenue) : 0,
      avgOrderValue: row ? (row.AVG_ORDER_VALUE !== undefined ? row.AVG_ORDER_VALUE : row.avg_order_value) : 0,
    };

    res.json(summary);
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to retrieve summary statistics",
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
