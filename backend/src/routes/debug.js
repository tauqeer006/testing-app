const express = require("express");
const { getReadConnection, getWriteConnection } = require("../db");
const { probeAll, getProviderMetadata } = require("../providers");

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

// GET /debug/db - Test and return read and write pool identities independently
router.get("/db", async (req, res) => {
  const result = {
    read: {},
    write: {},
  };

  // Test Read Pool
  let readConn;
  try {
    readConn = await getReadConnection();
    const readQuery = await readConn.execute("SELECT name FROM db_identity");
    const row = readQuery.rows && readQuery.rows[0];
    result.read = {
      identity: row ? (row.NAME || row.name || "UNKNOWN") : "UNKNOWN",
    };
  } catch (err) {
    result.read = {
      error: err.message,
      code: getOraCode(err),
    };
  } finally {
    if (readConn) {
      try {
        await readConn.close();
      } catch (closeErr) {
        console.error("Error closing read connection in debug:", closeErr);
      }
    }
  }

  // Test Write Pool
  let writeConn;
  try {
    writeConn = await getWriteConnection();
    const writeQuery = await writeConn.execute("SELECT name FROM db_identity");
    const row = writeQuery.rows && writeQuery.rows[0];
    result.write = {
      identity: row ? (row.NAME || row.name || "UNKNOWN") : "UNKNOWN",
    };
  } catch (err) {
    result.write = {
      error: err.message,
      code: getOraCode(err),
    };
  } finally {
    if (writeConn) {
      try {
        await writeConn.close();
      } catch (closeErr) {
        console.error("Error closing write connection in debug:", closeErr);
      }
    }
  }

  res.status(200).json(result);
});

// GET /debug/provider - Probes all external rate providers in parallel
router.get("/provider", async (req, res) => {
  try {
    const meta = getProviderMetadata();
    const probes = await probeAll();
    res.json({
      primary: meta.primary,
      order: meta.order,
      probes,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to probe providers",
    });
  }
});

module.exports = router;
