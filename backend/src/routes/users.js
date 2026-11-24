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

// GET /api/users - List all users (READ pool)
router.get("/users", async (req, res) => {
  let connection;
  try {
    connection = await getReadConnection();
    const result = await connection.execute(
      "SELECT id, name, email FROM users ORDER BY id ASC"
    );
    await setServedByHeader(connection, res);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to retrieve users",
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

// GET /api/next-user-id - TRAP endpoint, must stay on writePool
router.get("/next-user-id", async (req, res) => {
  let connection;
  try {
    connection = await getWriteConnection();
    const result = await connection.execute(
      "SELECT users_seq.NEXTVAL AS NEXT_ID FROM DUAL"
    );
    const row = result.rows && result.rows[0];
    const nextId = row ? (row.NEXT_ID || row.next_id) : null;
    res.json({ nextId });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to fetch next user ID",
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

// GET /api/users/:id - Get user by ID (READ pool)
router.get("/users/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: "Invalid user ID" });
  }

  let connection;
  try {
    connection = await getReadConnection();
    const result = await connection.execute(
      "SELECT id, name, email FROM users WHERE id = :id",
      { id: userId }
    );
    await setServedByHeader(connection, res);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to retrieve user",
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

// POST /api/users - Create new user (WRITE pool, using users_seq.NEXTVAL)
router.post("/users", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  let connection;
  try {
    connection = await getWriteConnection();
    const seqResult = await connection.execute(
      "SELECT users_seq.NEXTVAL AS ID FROM DUAL"
    );
    const newId = seqResult.rows[0].ID || seqResult.rows[0].id;

    await connection.execute(
      "INSERT INTO users (id, name, email) VALUES (:id, :name, :email)",
      { id: newId, name, email },
      { autoCommit: true }
    );

    res.status(201).json({
      id: newId,
      name,
      email,
      message: "User created successfully",
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to create user",
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
