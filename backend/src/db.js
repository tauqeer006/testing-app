const oracledb = require("oracledb");

// An agent will edit this file by exact string replacement, so use EXACTLY these top-level constants:
const PRIMARY_CONNECT_STRING = "oracle-primary:1521/FREEPDB1";
const SECONDARY_CONNECT_STRING = "oracle-secondary:1521/FREEPDB1";
const WRITE_POOL_CONNECT_STRING = PRIMARY_CONNECT_STRING;
const READ_POOL_CONNECT_STRING = SECONDARY_CONNECT_STRING;

// Only user/password come from env
const user = process.env.APP_USER || "APPUSER";
const password = process.env.APP_USER_PASSWORD || "AppUserPassword123!";

// Enable oracledb object output format by default
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

let writePool = null;
let readPool = null;

async function getWritePool() {
  if (!writePool) {
    try {
      writePool = await oracledb.createPool({
        user,
        password,
        connectString: WRITE_POOL_CONNECT_STRING,
        poolMin: 0,
        poolMax: 10,
        poolIncrement: 1,
        connectTimeout: 3,
        queueTimeout: 5000,
      });
    } catch (err) {
      writePool = null;
      throw err;
    }
  }
  return writePool;
}

async function getReadPool() {
  if (!readPool) {
    try {
      readPool = await oracledb.createPool({
        user,
        password,
        connectString: READ_POOL_CONNECT_STRING,
        poolMin: 0,
        poolMax: 10,
        poolIncrement: 1,
        connectTimeout: 3,
        queueTimeout: 5000,
      });
    } catch (err) {
      readPool = null;
      throw err;
    }
  }
  return readPool;
}

async function getWriteConnection() {
  const pool = await getWritePool();
  return await pool.getConnection();
}

async function getReadConnection() {
  const pool = await getReadPool();
  return await pool.getConnection();
}

module.exports = {
  getReadConnection,
  getWriteConnection,
};
