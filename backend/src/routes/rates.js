const express = require("express");
const { getRates } = require("../providers");

const router = express.Router();

function getSupportedCurrencies() {
  const envVal = process.env.SUPPORTED_CURRENCIES || "USD,EUR,GBP,JPY,INR,PKR";
  return envVal
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
}

// GET /api/rates?base=USD
router.get("/rates", async (req, res) => {
  const base = (req.query.base || "USD").toUpperCase();

  if (!/^[A-Z]{3}$/.test(base)) {
    return res.status(400).json({ error: "Invalid base currency code. Must be a 3-letter currency code." });
  }

  try {
    const ratesData = await getRates(base);
    res.setHeader("X-Provider-Used", ratesData.provider);
    res.json({
      base: ratesData.base,
      rates: ratesData.rates,
      provider: ratesData.provider,
      sourceDate: ratesData.sourceDate,
      fetchedAt: ratesData.fetchedAt,
      stale: Boolean(ratesData.stale),
      ageSeconds: ratesData.ageSeconds !== undefined ? ratesData.ageSeconds : 0,
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to fetch currency rates",
    });
  }
});

// GET /api/convert?amount=500&from=USD&to=EUR
router.get("/convert", async (req, res) => {
  const { amount: rawAmount, from: rawFrom, to: rawTo } = req.query;

  if (rawAmount === undefined || rawAmount === "") {
    return res.status(400).json({ error: "Query parameter 'amount' is required" });
  }

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e9) {
    return res.status(400).json({
      error: "Invalid amount. Must be a finite positive number not exceeding 1,000,000,000.",
    });
  }

  if (!rawFrom || !rawTo) {
    return res.status(400).json({ error: "Query parameters 'from' and 'to' are required" });
  }

  const from = String(rawFrom).trim().toUpperCase();
  const to = String(rawTo).trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return res.status(400).json({ error: "Currency codes 'from' and 'to' must be valid 3-letter codes" });
  }

  try {
    // Request rates with USD as reference base for cross-currency calculations
    const ratesData = await getRates("USD");
    res.setHeader("X-Provider-Used", ratesData.provider);

    const fromRate = ratesData.rates[from];
    if (fromRate === undefined) {
      return res.status(400).json({
        error: `Currency '${from}' is not supported by active provider '${ratesData.provider}'`,
        provider: ratesData.provider,
      });
    }

    const toRate = ratesData.rates[to];
    if (toRate === undefined) {
      return res.status(400).json({
        error: `Currency '${to}' is not supported by active provider '${ratesData.provider}'`,
        provider: ratesData.provider,
      });
    }

    // Cross-calculate rate: rate = toRate / fromRate
    const effectiveRate = from === to ? 1.0 : toRate / fromRate;
    const result = Math.round(amount * effectiveRate * 100) / 100;

    res.json({
      amount,
      from,
      to,
      rate: Number(effectiveRate.toFixed(6)),
      result,
      provider: ratesData.provider,
      stale: Boolean(ratesData.stale),
    });
  } catch (err) {
    res.status(500).json({
      error: err.message || "Failed to perform currency conversion",
    });
  }
});

module.exports = router;
