# Oracle Database Failover Test Application

A complete, runnable test application consisting of a **Node.js backend**, **Nginx web frontend**, and **two Oracle Free databases** (`oracle-primary` and `oracle-secondary`), fully orchestrated via **Docker Compose**.

This application is built specifically to test automated database-failover agents that edit the application's source code (`backend/src/db.js`) when the primary database experiences an outage.

---

## 🏗️ Architecture & Project Layout

```
failover-test-app/
├── docker-compose.yml              # 4-container orchestration with healthchecks & isolated network
├── .env.example                    # Environment variable template
├── .env                            # Active environment configuration
├── .gitignore                      # Git ignore file
├── README.md                       # Comprehensive guide and testing procedures
├── openapi.yaml                    # Full OpenAPI 3.0 specification with x-db-access tags
├── backend/
│   ├── Dockerfile                  # Node.js 20 Alpine container definition
│   ├── package.json                # Dependencies and Jest test runner scripts
│   ├── src/
│   │   ├── server.js               # Express application with process safety handlers
│   │   ├── db.js                   # Connection pooling & failover target constants
│   │   └── routes/                 # Pure Express routes (import only from db.js)
│   │       ├── users.js            # Reads & sequence-based user creation
│   │       ├── orders.js           # Joined reads, status patches, claim order trap
│   │       ├── products.js         # Products catalog with minPrice filter
│   │       ├── stats.js            # Database aggregate statistics
│   │       ├── audit.js            # Calls stored procedure add_audit_log
│   │       ├── health.js           # /health check (never touches DB)
│   │       └── debug.js            # /debug/db pool diagnostics
│   └── tests/                      # Supertest + Jest automated test suite
│       ├── users.test.js
│       ├── orders.test.js
│       ├── products.test.js
│       ├── stats.test.js
│       ├── audit.test.js
│       ├── health.test.js
│       ├── debug.test.js
│       └── failover.test.js        # Validates X-DB-Served-By and pool identity
├── frontend/
│   ├── Dockerfile                  # Nginx Alpine proxy container
│   ├── nginx.conf                  # Static web server + proxy for /api/ & /debug/
│   └── public/
│       ├── index.html              # Modern dashboard with live DB identity badge
│       ├── app.js                  # Auto-refreshes every 5s & extracts X-DB-Served-By
│       └── style.css               # Clean dark-mode responsive styling
└── db/
    ├── common/
    │   ├── 01_schema.sql           # Schema definition (users, orders, products, audit_log, db_identity)
    │   └── 02_seed.sql             # Seed data (12 users, 25 orders, 18 products)
    ├── primary/
    │   └── 03_identity.sql         # Seeds db_identity with 'PRIMARY'
    └── secondary/
        └── 03_identity.sql         # Seeds db_identity with 'SECONDARY'
```

---

## 🚀 Services & Accessible URLs

When running with Docker Compose, the following services and endpoints are available:

| Service | Host Port | Target URL | Description |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | `8080` | [http://localhost:8080](http://localhost:8080) | Interactive dashboard with live `X-DB-Served-By` badge |
| **Backend API** | `3000` | [http://localhost:3000](http://localhost:3000) | Express REST API endpoints |
| **Primary Oracle DB** | `1521` | `localhost:1521/FREEPDB1` | Read + Write Database |
| **Secondary Oracle DB** | `1522` | `localhost:1522/FREEPDB1` | Standby Read Replica |

---

## ⚙️ Quick Start

### 1. Start all services
Ensure Docker Desktop is running, then execute:

```bash
docker compose up -d --build
```

*(Note: Oracle Database containers run faststart initialization and execute the `.sql` scripts inside `/container-entrypoint-initdb.d/`. Wait ~30–60 seconds for both database containers to become healthy).*

You can monitor database health status via:
```bash
docker compose ps
```

### 2. Open the Web Dashboard
Open [http://localhost:8080](http://localhost:8080) in your browser:
* The header badge will display **"Reads served by: PRIMARY"** in **green**.
* All tabs (Users, Orders, Products, Stats) auto-refresh every 5 seconds.
* You can trigger writes (Add User, Claim Order, Next User ID, Audit Log) from the UI toolbar.

---

## 🎯 How Connection Routing & Failover Work

### 1. Connection Pool Code (`backend/src/db.js`)
All database traffic routes through `backend/src/db.js`. It exposes two connection functions:
* `getReadConnection()`: Used exclusively by read-only endpoints (`GET /api/users`, `GET /api/orders`, etc.).
* `getWriteConnection()`: Used by write operations and trap endpoints.

Top-level connect constants are explicitly defined as string literals:
```javascript
const PRIMARY_CONNECT_STRING = "oracle-primary:1521/FREEPDB1";
const SECONDARY_CONNECT_STRING = "oracle-secondary:1521/FREEPDB1";
const WRITE_POOL_CONNECT_STRING = PRIMARY_CONNECT_STRING;
const READ_POOL_CONNECT_STRING = PRIMARY_CONNECT_STRING;
```

### 2. Trap Endpoints (Must Stay on Primary)
Some endpoints look like read queries but modify database state or lock rows. They are intentionally kept on the write pool:
* `GET /api/next-user-id`: Invokes `SELECT users_seq.NEXTVAL FROM DUAL` on `writePool`.
* `POST /api/orders/:id/claim`: Invokes `SELECT ... FOR UPDATE` followed by `UPDATE` on `writePool`.
* `POST /api/audit`: Invokes the stored procedure `add_audit_log(p_message)` on `writePool`.

### 3. Failover Agent Contract
When the primary database fails:
1. The failover agent inspects `backend/src/db.js`.
2. The agent edits **ONLY** the `READ_POOL_CONNECT_STRING` definition:
   ```javascript
   // BEFORE:
   const READ_POOL_CONNECT_STRING = PRIMARY_CONNECT_STRING;

   // AFTER FAILOVER:
   const READ_POOL_CONNECT_STRING = SECONDARY_CONNECT_STRING;
   ```
3. The backend container is rebuilt/restarted:
   ```bash
   docker compose up -d --build backend
   ```
4. Reads immediately recover and return HTTP 200 with header `X-DB-Served-By: SECONDARY`.
5. Writes continue targeting `WRITE_POOL_CONNECT_STRING` (Primary) and fail cleanly while primary is down.

---

## 🧪 Outage & Failover Simulation Walkthrough

Follow these steps to test the failover workflow:

### Step 1: Verify Initial State
Confirm that both databases are healthy and the application is serving reads from `PRIMARY`:
```bash
curl -i http://localhost:3000/api/users
```
**Expected Response:** HTTP 200 with header `X-DB-Served-By: PRIMARY`.

Check `/debug/db`:
```bash
curl http://localhost:3000/debug/db
```
**Expected Response:**
```json
{
  "read": { "identity": "PRIMARY" },
  "write": { "identity": "PRIMARY" }
}
```

### Step 2: Simulate Primary Outage
Stop the primary database container:
```bash
docker compose stop oracle-primary
```

### Step 3: Observe Outage Behavior
* **Backend Stays Up:** The backend process never crashes.
* **Health Check Works:** `GET /health` continues to return `{ "status": "ok" }`:
  ```bash
  curl http://localhost:3000/health
  ```
* **Reads Fail Cleanly:** Read endpoints return HTTP 500 JSON with Oracle error codes:
  ```bash
  curl -i http://localhost:3000/api/users
  ```
  Returns `{"error":"...","code":"ORA-12170"}` or `ORA-12541`.
* **Frontend Badge:** The dashboard badge switches to **"Reads served by: ERROR"** in **red**.

### Step 4: Apply Failover (Source Code Edit)
Simulate the automated failover agent by editing `backend/src/db.js`:
Change:
```javascript
const READ_POOL_CONNECT_STRING = PRIMARY_CONNECT_STRING;
```
to:
```javascript
const READ_POOL_CONNECT_STRING = SECONDARY_CONNECT_STRING;
```

### Step 5: Rebuild the Backend
Rebuild and restart the backend container without restarting the stopped primary database:
```bash
docker compose up -d --build backend
```

### Step 6: Verify Failover Success
1. **Reads Recover:** Query any read endpoint:
   ```bash
   curl -i http://localhost:3000/api/users
   ```
   **Expected Response:** HTTP 200 with header `X-DB-Served-By: SECONDARY`!
2. **Frontend UI:** The header badge turns **orange**: **"Reads served by: SECONDARY"**.
3. **Writes Expectedly Fail:**
   ```bash
   curl -i -X POST http://localhost:3000/api/users \
     -H "Content-Type: application/json" \
     -d '{"name":"Failover Test","email":"failover@example.com"}'
   ```
   **Expected Response:** HTTP 500 with ORA code because writes correctly remain pinned to the primary database.

### Step 7: Restore Primary Database
Bring the primary database back online:
```bash
docker compose start oracle-primary
```
Once healthy, writes recover automatically without requiring another restart.

---

## 🔬 Automated Test Suite

The backend includes a comprehensive Jest test suite that runs against the live environment via `BASE_URL` (default: `http://localhost:3000`).

To run tests:
```bash
cd backend
npm install
npm test
```

### Specialized Test Scripts:
* **`npm run test:smoke`**: Tests `/health` and `/debug/db`.
* **`npm run test:reads`**: Verifies failover reads and validates `X-DB-Served-By` against `EXPECTED_READ_DB`.
  ```bash
  # Test against primary (default):
  npm run test:reads

  # Test against secondary after failover:
  EXPECTED_READ_DB=SECONDARY npm run test:reads
  ```
* **`npm test`**: Runs the entire test suite across all route groups.

---

## 🛡️ Process Safety & Database Best Practices
* **Thin Mode:** Uses `oracledb` v6 pure JavaScript Thin mode without requiring Oracle Instant Client binaries.
* **Fast Failure & Lazy Pooling:** `poolMin: 0` and `connectTimeout: 3` ensure the backend boots instantaneously without hanging if a database is down.
* **Connection Safety:** Connections are acquired per-request and always released inside `finally` blocks.
* **Crash Protection:** Express error handlers, `uncaughtException`, and `unhandledRejection` handlers prevent process termination on database faults.
