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

// Rolling buffer for RUM beacons (max 1000 entries)
const MAX_BEACONS = 1000;
let rumBeacons = [];
let beaconSequence = 0;

// POST /debug/rum - Ingest beacon from client browsers
router.post("/rum", express.json({ limit: "256kb", type: ["application/json", "text/plain"] }), (req, res) => {
  try {
    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch (parseErr) {
        return res.status(400).json({ error: "Invalid beacon payload" });
      }
    }

    if (!payload || typeof payload !== "object") {
      return res.status(400).json({ error: "Invalid beacon payload" });
    }

    beaconSequence += 1;
    const beacon = {
      ...payload,
      id: beaconSequence,
      receivedAt: new Date().toISOString(),
    };

    rumBeacons.push(beacon);
    if (rumBeacons.length > MAX_BEACONS) {
      rumBeacons.shift();
    }

    return res.status(201).json({ status: "ok", id: beaconSequence });
  } catch (err) {
    return res.status(400).json({ error: "Invalid beacon payload" });
  }
});

// GET /debug/rum?since=<cursor> - Polled by Rectification Agent
router.get("/rum", (req, res) => {
  const token = req.headers["x-debug-token"];
  const expectedToken = process.env.RUM_DEBUG_TOKEN;

  if (expectedToken && token !== expectedToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const since = parseInt(req.query.since || "0", 10);
  const targetSince = isNaN(since) ? 0 : since;
  const newBeacons = rumBeacons
    .filter((b) => b.id > targetSince)
    .sort((a, b) => a.id - b.id);
  return res.status(200).json(newBeacons);
});

// Helper for automated testing to reset in-memory beacons
router._resetBeaconsForTest = () => {
  rumBeacons = [];
  beaconSequence = 0;
};

module.exports = router;
