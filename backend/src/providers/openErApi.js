const PROVIDER_NAME = "open_er_api";

function getUrl(base) {
  const upperBase = base.toUpperCase();
  const lowerBase = base.toLowerCase();
  const isMock = process.env.USE_MOCK_PROVIDERS === "true";
  const template = isMock
    ? (process.env.MOCK_OPEN_ER_API_URL || "http://mock-providers:4000/open_er_api/v6/latest/{BASE}")
    : (process.env.OPEN_ER_API_URL || "https://open.er-api.com/v6/latest/{BASE}");
  return template.replace(/\{BASE\}/g, upperBase).replace(/\{base\}/g, lowerBase);
}

async function fetchRates(base = "USD") {
  const upperBase = base.toUpperCase();
  const url = getUrl(upperBase);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "failover-test-app/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`[${PROVIDER_NAME}] HTTP error ${response.status} (${response.statusText})`);
    }

    let data;
    try {
      data = await response.json();
    } catch (parseErr) {
      throw new Error(`[${PROVIDER_NAME}] Invalid JSON response: ${parseErr.message}`);
    }

    // Strict validation
    if (!data || typeof data !== "object") {
      throw new Error(`[${PROVIDER_NAME}] Response payload must be an object`);
    }
    // "the adapter must require result === 'success'"
    if (data.result !== "success") {
      throw new Error(`[${PROVIDER_NAME}] Provider reported failure result: '${data.result || "unknown"}'`);
    }
    if (!data.rates || typeof data.rates !== "object") {
      throw new Error(`[${PROVIDER_NAME}] Response missing or invalid 'rates' object`);
    }

    const rates = {};
    for (const [curr, rate] of Object.entries(data.rates)) {
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`[${PROVIDER_NAME}] Invalid rate value for currency '${curr}': ${rate}`);
      }
      rates[curr.toUpperCase()] = rate;
    }

    if (!rates[upperBase]) {
      rates[upperBase] = 1.0;
    }

    const sourceDate = data.time_last_update_utc
      ? new Date(data.time_last_update_utc).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0];

    return {
      base: upperBase,
      rates,
      provider: PROVIDER_NAME,
      sourceDate,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`[${PROVIDER_NAME}] Request timed out after 5000ms`);
    }
    throw new Error(err.message.startsWith(`[${PROVIDER_NAME}]`) ? err.message : `[${PROVIDER_NAME}] ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function probe() {
  const start = Date.now();
  try {
    const data = await fetchRates("USD");
    return {
      provider: PROVIDER_NAME,
      ok: true,
      latencyMs: Date.now() - start,
      error: null,
      httpStatus: 200,
    };
  } catch (err) {
    return {
      provider: PROVIDER_NAME,
      ok: false,
      latencyMs: Date.now() - start,
      error: err.message,
      httpStatus: err.message.includes("HTTP error") ? parseInt(err.message.match(/HTTP error (\d+)/)?.[1] || "500", 10) : 500,
    };
  }
}

module.exports = {
  PROVIDER_NAME,
  fetchRates,
  probe,
};
