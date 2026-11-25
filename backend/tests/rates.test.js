const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Currency Rates and Conversion Endpoints", () => {
  test("GET /api/rates returns 200, rates map, and X-Provider-Used header", async () => {
    const res = await request(BASE_URL).get("/api/rates?base=USD");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("base", "USD");
    expect(res.body).toHaveProperty("rates");
    expect(res.body).toHaveProperty("provider");
    expect(res.headers["x-provider-used"]).toBeDefined();
    expect(res.body.rates.USD).toBe(1);
    expect(Number(res.body.rates.EUR)).toBeGreaterThan(0);
  });

  test("GET /api/convert calculates 500 USD to EUR correctly", async () => {
    const res = await request(BASE_URL).get("/api/convert?amount=500&from=USD&to=EUR");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("amount", 500);
    expect(res.body).toHaveProperty("from", "USD");
    expect(res.body).toHaveProperty("to", "EUR");
    expect(res.body).toHaveProperty("rate");
    expect(res.body).toHaveProperty("result");
    expect(res.body).toHaveProperty("provider");
    expect(res.headers["x-provider-used"]).toBeDefined();

    // Verify mathematical accuracy
    const expected = Math.round(500 * res.body.rate * 100) / 100;
    expect(res.body.result).toBe(expected);
  });

  test("GET /api/convert returns 400 for unsupported currency on frankfurter (PKR)", async () => {
    const res = await request(BASE_URL).get("/api/convert?amount=100&from=USD&to=PKR");
    // If active provider is frankfurter, PKR must return 400 with a clear message
    if (res.headers["x-provider-used"] === "frankfurter" || res.body.provider === "frankfurter") {
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/PKR/);
      expect(res.body.error).toMatch(/frankfurter/);
    } else {
      // If active provider is open_er_api or currency_api_cdn, PKR is supported
      expect(res.status).toBe(200);
      expect(res.body.to).toBe("PKR");
    }
  });

  test("GET /api/convert validates invalid amount (negative or zero)", async () => {
    const res = await request(BASE_URL).get("/api/convert?amount=-50&from=USD&to=EUR");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  test("GET /api/convert validates excessive amount (> 1e9)", async () => {
    const res = await request(BASE_URL).get("/api/convert?amount=2000000000&from=USD&to=EUR");
    expect(res.status).toBe(400);
  });

  test("GET /debug/provider returns probes for every provider in parallel", async () => {
    const res = await request(BASE_URL).get("/debug/provider");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("primary");
    expect(res.body).toHaveProperty("order");
    expect(Array.isArray(res.body.probes)).toBe(true);
    expect(res.body.probes.length).toBe(3);

    const providerNames = res.body.probes.map((p) => p.provider);
    expect(providerNames).toContain("frankfurter");
    expect(providerNames).toContain("open_er_api");
    expect(providerNames).toContain("currency_api_cdn");
  });
});
