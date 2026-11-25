const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Simulation state for providers
const state = {
  frankfurter: { status: "up", mode: null },
  open_er_api: { status: "up", mode: null },
  currency_api_cdn: { status: "up", mode: null },
};

// Fixed sample rates (about 10 currencies; EUR/GBP/JPY/INR; PKR only on open_er_api and currency_api_cdn)
const frankfurterRates = {
  AUD: 1.5057,
  EUR: 0.91216,
  GBP: 0.76348,
  JPY: 159.07,
  INR: 92.92,
  CAD: 1.402,
  CHF: 0.884,
  CNY: 7.245,
  SGD: 1.345,
  NZD: 1.712,
}; // NO PKR, and base USD not included in rates

const openErApiRates = {
  USD: 1,
  EUR: 0.91245,
  GBP: 0.76412,
  JPY: 159.10,
  INR: 92.95,
  PKR: 276.39191,
  CAD: 1.4025,
  AUD: 1.506,
  CHF: 0.882,
  CNY: 7.245,
};

const cdnRates = {
  eur: 0.91609163,
  gbp: 0.76618312,
  pkr: 277.03965199,
  jpy: 159.20,
  inr: 92.98,
  cad: 1.405,
  aud: 1.508,
  chf: 0.884,
  cny: 7.25,
  usd: 1.0,
  btc: 0.0000166,
  "1inch": 16.78,
};

function handleFailure(providerName, req, res) {
  const p = state[providerName];
  if (!p || p.status !== "down") {
    return false;
  }

  if (p.mode === "timeout") {
    // Exceeds the 5000ms client timeout
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).send("Gateway Timeout (simulated)");
      }
    }, 8000);
    return true;
  }

  if (p.mode === "garbage") {
    // HTTP 200 with invalid payload (corrupt structure)
    res.status(200).json({
      corrupt: true,
      rates: "not-an-object",
      error: "Malformed rates response payload",
    });
    return true;
  }

  // Default: mode 503
  res.status(503).json({
    error: `Service ${providerName} is currently unavailable (simulated outage)`,
    code: "SERVICE_UNAVAILABLE",
  });
  return true;
}

// 1. Frankfurter mock: GET /frankfurter/v1/latest?base=USD
app.get("/frankfurter/v1/latest", (req, res) => {
  if (handleFailure("frankfurter", req, res)) return;

  const base = (req.query.base || "USD").toUpperCase();
  res.json({
    amount: 1.0,
    base,
    date: "2026-11-24",
    rates: frankfurterRates,
  });
});

// 2. Open Exchange Rates mock: GET /open_er_api/v6/latest/USD
app.get(["/open_er_api/v6/latest", "/open_er_api/v6/latest/:base"], (req, res) => {
  if (handleFailure("open_er_api", req, res)) return;

  const base = (req.params.base || req.query.base || "USD").toUpperCase();
  res.json({
    result: "success",
    base_code: base,
    time_last_update_utc: "Tue, 24 Nov 2026 00:02:01 +0000",
    rates: openErApiRates,
  });
});

// 3. Currency API CDN primary host mock: GET /currency_api_cdn/v1/currencies/usd.json
app.get(["/currency_api_cdn/v1/currencies/:file", "/currency_api_cdn/v1/currencies/usd.json"], (req, res) => {
  if (handleFailure("currency_api_cdn", req, res)) return;

  const file = req.params.file || "usd.json";
  const baseKey = file.replace(/\.json$/i, "").toLowerCase();
  res.json({
    date: "2026-11-24",
    [baseKey]: cdnRates,
  });
});

// 4. Currency API Pages mirror host mock: GET /currency_api_pages/v1/currencies/usd.json
// Taking down currency_api_cdn affects both its hosts
app.get(["/currency_api_pages/v1/currencies/:file", "/currency_api_pages/v1/currencies/usd.json"], (req, res) => {
  if (handleFailure("currency_api_cdn", req, res)) return;

  const file = req.params.file || "usd.json";
  const baseKey = file.replace(/\.json$/i, "").toLowerCase();
  res.json({
    date: "2026-11-24",
    [baseKey]: cdnRates,
  });
});

// Admin endpoints
app.post("/admin/down/:provider", (req, res) => {
  const provider = req.params.provider;
  const mode = req.query.mode || "503"; // 503 | timeout | garbage

  if (!state[provider]) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  state[provider] = { status: "down", mode };
  res.json({
    message: `Provider '${provider}' marked DOWN with mode '${mode}'`,
    state,
  });
});

app.post("/admin/up/:provider", (req, res) => {
  const provider = req.params.provider;

  if (!state[provider]) {
    return res.status(400).json({ error: `Unknown provider: ${provider}` });
  }

  state[provider] = { status: "up", mode: null };
  res.json({
    message: `Provider '${provider}' marked UP`,
    state,
  });
});

app.get("/admin/state", (req, res) => {
  res.json(state);
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "mock-providers" });
});

app.listen(PORT, () => {
  console.log(`Mock Providers service listening on port ${PORT}`);
});
