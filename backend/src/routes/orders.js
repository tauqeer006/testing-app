const express = require("express");
const { getReadConnection, getWriteConnection } = require("../db");

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

// GET /api/orders - List orders JOIN with users (READ pool)
router.get("/orders", async (req, res) => {
  let connection;
  try {
    connection = await getReadConnection();
    const result = await connection.execute(
      `SELECT o.id, o.user_id, u.name AS user_name, u.email AS user_email, o.status, o.total 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       ORDER BY o.id ASC`
    );
    await setServedByHeader(connection, res);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to retrieve orders",
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

// GET /api/orders/:id - Get single order JOIN with users (READ pool)
router.get("/orders/:id", async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  let connection;
  try {
    connection = await getReadConnection();
    const result = await connection.execute(
      `SELECT o.id, o.user_id, u.name AS user_name, u.email AS user_email, o.status, o.total 
       FROM orders o 
       JOIN users u ON o.user_id = u.id 
       WHERE o.id = :id`,
      { id: orderId }
    );
    await setServedByHeader(connection, res);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to retrieve order",
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

// PATCH /api/orders/:id/status - Update order status (WRITE pool)
router.patch("/orders/:id/status", async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (isNaN(orderId)) {
    return res.status(400).json({ error: "Invalid order ID" });
  }
  if (!status) {
    return res.status(400).json({ error: "Status is required" });
  }

  let connection;
  try {
    connection = await getWriteConnection();
    const result = await connection.execute(
      "UPDATE orders SET status = :status WHERE id = :id",
      { status, id: orderId },
      { autoCommit: true }
    );

    if (result.rowsAffected === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({
      id: orderId,
      status,
      message: "Order status updated successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to update order status",
      code: getOraCode(err),
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("Error closing write connection:", closeErr);
      }
    }
  }
});

// POST /api/orders/:id/claim - TRAP endpoint: SELECT ... FOR UPDATE then UPDATE (WRITE pool)
router.post("/orders/:id/claim", async (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  if (isNaN(orderId)) {
    return res.status(400).json({ error: "Invalid order ID" });
  }

  let connection;
  try {
    connection = await getWriteConnection();

    // Lock the row with SELECT FOR UPDATE
    const selectResult = await connection.execute(
      "SELECT id, status FROM orders WHERE id = :id FOR UPDATE",
      { id: orderId }
    );

    if (selectResult.rows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found" });
    }

    // Perform UPDATE
    await connection.execute(
      "UPDATE orders SET status = 'CLAIMED' WHERE id = :id",
      { id: orderId }
    );

    await connection.commit();

    res.json({
      id: orderId,
      status: "CLAIMED",
      message: "Order claimed successfully",
    });
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rbErr) {
        console.error("Rollback error:", rbErr);
      }
    }
    res.status(500).json({
      error: err.message || "Failed to claim order",
      code: getOraCode(err),
    });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (closeErr) {
        console.error("Error closing write connection:", closeErr);
      }
    }
  }
});

module.exports = router;
