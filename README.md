# Oracle Database Failover & Third-Party Exchange Rates Test Application

A complete, runnable test application consisting of a **Node.js backend**, **Nginx web frontend**, **two Oracle Free databases** (`oracle-primary` and `oracle-secondary`), and a **Mock Providers service** (`mock-providers`), fully orchestrated via **Docker Compose**.

This application is built specifically to test automated agents that perform code-level failover for:
1. **Database Outages**: Failing over reads from the primary Oracle instance to the secondary replica by editing `backend/src/db.js`.
2. **Third-Party API Outages**: Failing over currency exchange rate providers across three interchangeable providers by editing `backend/src/providers/index.js`.

---

## 🏗️ Architecture & Project Layout

```
failover-test-app/
├── docker-compose.yml              # 5-container orchestration with healthchecks & isolated network
├── .env.example                    # Environment variable template
├── .env                            # Active environment configuration
├── .gitignore                      # Git ignore file
├── README.md                       # Comprehensive guide and testing procedures
├── openapi.yaml                    # Full OpenAPI 3.0 specification with x-db-access and x-external tags
├── backend/
│   ├── Dockerfile                  # Node.js 20 Alpine container definition
│   ├── package.json                # Dependencies and Jest test runner scripts
│   ├── src/
│   │   ├── server.js               # Express application with process safety handlers
│   │   ├── db.js                   # Connection pooling & failover target constants
│   │   ├── providers/              # Third-party rates provider adapters & cache
│   │   │   ├── index.js            # PRIMARY_PROVIDER constant & getRates() entrypoint
│   │   │   ├── frankfurter.js      # Frankfurter API adapter + probe
│   │   │   ├── openErApi.js        # Open Exchange Rates API adapter + probe
│   │   │   ├── currencyApiCdn.js   # Currency API CDN (primary + mirror fallback) + probe
│   │   │   └── cache.js            # In-memory per-provider cache with TTL & stale fallback
│   │   └── routes/                 # Express API routes
│   │       ├── users.js            # Reads & sequence-based user creation
│   │       ├── orders.js           # Joined reads, status patches, claim order trap
│   │       ├── products.js         # Products catalog with minPrice & ?currency= conversion
│   │       ├── stats.js            # Database aggregate statistics
│   │       ├── audit.js            # Calls stored procedure add_audit_log
│   │       ├── rates.js            # GET /api/rates & GET /api/convert
│   │       ├── health.js           # /health check (never touches DB or providers)
│   │       └── debug.js            # /debug/db & /debug/provider diagnostics
│   └── tests/                      # Supertest + Jest automated test suite
│       ├── providers.test.js       # Adapter unit tests, payload normalization, mirror fallback
│       ├── cache.test.js           # TTL, stale window, and provider cache isolation tests
│       ├── rates.test.js           # Conversion math, 400 on unsupported currencies, probes
│       ├── users.test.js           # User reads, sequence writes, trap endpoint
│       ├── orders.test.js          # Joined reads and claim order trap
│       ├── products.test.js        # Catalog, filtering, and currency conversion
│       ├── stats.test.js           # Database summary aggregates
│       ├── audit.test.js           # Stored procedure execution
│       ├── health.test.js          # /health isolation check
│       ├── debug.test.js           # /debug/db pool identities
│       └── failover.test.js        # Validates X-DB-Served-By and pool identity
├── frontend/
│   ├── Dockerfile                  # Nginx Alpine proxy container
│   ├── nginx.conf                  # Static web server + proxy for /api/ & /debug/
│   └── public/
│       ├── index.html              # Modern dashboard with live DB & Provider badges + Converter
│       ├── app.js                  # Currency selector, real-time conversion & attribution link
│       └── style.css               # Clean dark-mode responsive styling
├── mock-providers/                 # Mock Third-Party Rate Providers service
│   ├── Dockerfile                  # Node.js 20 Alpine container
│   ├── package.json                # Express & CORS dependencies
│   └── server.js                   # Mocks for Frankfurter, Open Exchange Rates, CDN & Mirror
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
| **Frontend UI** | `8080` | [http://localhost:8080](http://localhost:8080) | Interactive dashboard with live DB badge, Rates badge & Converter |
| **Backend API** | `3000` | [http://localhost:3000](http://localhost:3000) | Express REST API endpoints |
| **Mock Providers** | `4000` | [http://localhost:4000](http://localhost:4000) | Mock API for offline testing & fault injection |
| **Primary Oracle DB** | `1521` | `localhost:1521/FREEPDB1` | Read + Write Database |
| **Secondary Oracle DB** | `1522` | `localhost:1522/FREEPDB1` | Standby Read Replica |

---

## 💱 Third-Party Rates Providers & Limits

The application integrates with three interchangeable free providers (no API keys required):

| Provider Name | Primary Endpoint | Currencies Supported | Special Characteristics & Requirements |
| :--- | :--- | :--- | :--- |
| **`frankfurter`** | `https://api.frankfurter.dev/v1/latest?base=USD` | ~29 currencies (EUR, GBP, JPY, INR, etc.) | **Does NOT support PKR**. Base currency is omitted from the raw rates response; the adapter automatically injects `base: 1.0`. |
| **`open_er_api`** | `https://open.er-api.com/v6/latest/USD` | ~160 currencies (includes PKR) | Requires `result === "success"`. **Terms require attribution**: frontend displays a visible `"Rates by ExchangeRate-API"` link whenever this provider is active. |
| **`currency_api_cdn`** | `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json` | ~150 currencies (includes PKR) | Base code and rates keys are lowercase; includes crypto/obsolete codes. The adapter uppercases codes, filters via `/^[a-z]{3}$/i`, and automatically fails over to the mirror host (`https://latest.currency-api.pages.dev/v1/currencies/usd.json`) if the primary CDN fails. |

All URLs in `.env` support `{BASE}` (uppercase) and `{base}` (lowercase) template placeholders.

---

## 🧠 In-Memory Cache Architecture

* **Cache Key Isolation**: Keys are stored per `provider:BASE` (e.g. `frankfurter:USD`, `open_er_api:USD`). When `PRIMARY_PROVIDER` changes, old-provider cached data is **never** reused.
* **TTL (`RATES_CACHE_TTL_SECONDS`, default 600s)**: Responses within TTL are served fresh (`stale: false`, `ageSeconds`).
* **Stale Serving Fallback (`RATES_STALE_MAX_SECONDS`, default 3600s)**: If the active provider fails, cached entries are served with `stale: true` and `ageSeconds` for up to 1 hour before an error is returned.

---

## ⚙️ Quick Start

```bash
cd failover-test-app
docker compose up -d --build
```

Access the frontend dashboard at **[http://localhost:8080](http://localhost:8080)**.

---

## 🧪 Outage & Failover Simulation Walkthrough

### Scenario A: Testing Real Providers
1. Convert 500 USD to EUR:
   ```bash
   curl "http://localhost:3000/api/convert?amount=500&from=USD&to=EUR"
   ```
   *Returns HTTP 200 with `provider: "frankfurter"`, header `X-Provider-Used: frankfurter`, and result `456.08`.*
2. Attempt to convert to PKR on Frankfurter:
   ```bash
   curl -i "http://localhost:3000/api/convert?amount=500&from=USD&to=PKR"
   ```
   *Returns HTTP 400: `{"error":"Currency 'PKR' is not supported by active provider 'frankfurter'"}`.*

---

### Scenario B: Simulating Provider Outages via Mock Service
1. **Enable Mocks in `.env`**:
   In `.env`, set:
   ```bash
   USE_MOCK_PROVIDERS=true
   ```
2. **Recreate the Backend**:
   ```bash
   docker compose up -d --build backend
   ```
3. **Check Provider Status**:
   ```bash
   curl http://localhost:3000/debug/provider
   ```
   *All three providers report `"ok": true`.*
4. **Take Down Frankfurter**:
   Simulate a 503 outage on Frankfurter:
   ```bash
   curl -X POST "http://localhost:4000/admin/down/frankfurter?mode=503"
   ```
   *(Supported modes: `503`, `timeout`, or `garbage`)*
5. **Observe Failure & Stale Fallback**:
   * If cached: `GET /api/rates?base=USD` returns cached rates with `stale: true`.
   * When un-cached: Returns HTTP 500 naming the provider: `[frankfurter] HTTP error 503`.
   * Probes at `GET /debug/provider` report Frankfurter as `"ok": false`.

---

### Scenario C: Failing Over to a Secondary Provider
1. **Edit `backend/src/providers/index.js`**:
   Change:
   ```javascript
   const PRIMARY_PROVIDER = "frankfurter";
   ```
   to:
   ```javascript
   const PRIMARY_PROVIDER = "open_er_api";
   ```
2. **Rebuild the Backend**:
   ```bash
   docker compose up -d --build backend
   ```
3. **Verify Recovery & PKR Support**:
   ```bash
   curl "http://localhost:3000/api/convert?amount=500&from=USD&to=PKR"
   ```
   *Now succeeds with HTTP 200 using `open_er_api`!*
4. **Attribution**:
   Open [http://localhost:8080](http://localhost:8080). The footer and rates badge immediately display `"Rates by ExchangeRate-API"`.
5. **Restore Frankfurter**:
   ```bash
   curl -X POST "http://localhost:4000/admin/up/frankfurter"
   ```

---

## 🔬 Automated Testing

Run the full Jest test suite across all 11 test suites:

```bash
docker exec -e BASE_URL=http://localhost:3000 failover-backend npm test
```

* Tests adapter normalization and error handling.
* Tests mirror fallback when CDN primary host is down.
* Tests cache TTL and stale serving boundaries.
* Tests conversion math and 400 validations.
* Tests products catalog currency conversion and database failover.
