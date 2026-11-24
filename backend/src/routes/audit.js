const express = require("express");
const { getWriteConnection } = require("../db");

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

// POST /api/audit - Call stored procedure add_audit_log (WRITE pool)
router.post("/audit", async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required for audit log" });
  }

  let connection;
  try {
    connection = await getWriteConnection();
    await connection.execute(
      "BEGIN add_audit_log(:message); END;",
      { message }
    );

    res.status(201).json({
      message: "Audit log entry created successfully",
      auditMessage: message,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to create audit log entry",
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
