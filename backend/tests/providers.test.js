const frankfurter = require("../src/providers/frankfurter");
const openErApi = require("../src/providers/openErApi");
const currencyApiCdn = require("../src/providers/currencyApiCdn");

describe("Third-Party Provider Adapters", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe("Frankfurter Adapter", () => {
    test("normalizes valid payload and adds base currency to rates", async () => {
      const mockPayload = {
        amount: 1.0,
        base: "USD",
        date: "2026-11-24",
        rates: {
          AUD: 1.5057,
          EUR: 0.91216,
          GBP: 0.76348,
          JPY: 159.07,
          INR: 92.92,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const res = await frankfurter.fetchRates("USD");
      expect(res.provider).toBe("frankfurter");
      expect(res.base).toBe("USD");
      expect(res.sourceDate).toBe("2026-11-24");
      expect(res.rates.USD).toBe(1.0); // Base added
      expect(res.rates.EUR).toBe(0.91216);
      expect(res.rates.PKR).toBeUndefined(); // Frankfurter does not support PKR
      expect(res.fetchedAt).toBeDefined();
    });

    test("rejects invalid rates payload even on HTTP 200", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ base: "USD", date: "2026-11-24", rates: { EUR: -0.5 } }),
      });

      await expect(frankfurter.fetchRates("USD")).rejects.toThrow(/\[frankfurter\]/);
    });

    test("probe() reports healthy response with latency", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ base: "USD", date: "2026-11-24", rates: { EUR: 0.91 } }),
      });

      const probeResult = await frankfurter.probe();
      expect(probeResult.ok).toBe(true);
      expect(probeResult.provider).toBe("frankfurter");
      expect(probeResult.httpStatus).toBe(200);
      expect(typeof probeResult.latencyMs).toBe("number");
    });
  });

  describe("Open Exchange Rates (open_er_api) Adapter", () => {
    test("normalizes valid payload and validates result === 'success'", async () => {
      const mockPayload = {
        result: "success",
        base_code: "USD",
        time_last_update_utc: "Tue, 24 Nov 2026 00:02:01 +0000",
        rates: {
          USD: 1,
          EUR: 0.91245,
          PKR: 276.39191,
          GBP: 0.76412,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const res = await openErApi.fetchRates("USD");
      expect(res.provider).toBe("open_er_api");
      expect(res.base).toBe("USD");
      expect(res.rates.PKR).toBe(276.39191);
      expect(res.rates.USD).toBe(1);
    });

    test("throws error when result !== 'success'", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: "error", "error-type": "invalid-key" }),
      });

      await expect(openErApi.fetchRates("USD")).rejects.toThrow(
        /\[open_er_api\] Provider reported failure result/
      );
    });
  });

  describe("Currency API CDN Adapter", () => {
    test("normalizes lowercase base and currencies, filters crypto and obsolete codes", async () => {
      const mockPayload = {
        date: "2026-11-24",
        usd: {
          eur: 0.91609163,
          gbp: 0.76618312,
          pkr: 277.03965199,
          btc: 0.0000166,
          "1inch": 16.78,
          usd: 1.0,
        },
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockPayload,
      });

      const res = await currencyApiCdn.fetchRates("USD");
      expect(res.provider).toBe("currency_api_cdn");
      expect(res.rates.EUR).toBe(0.91609163);
      expect(res.rates.PKR).toBe(277.03965199);
      expect(res.rates["1INCH"]).toBeUndefined(); // Non 3-letter code filtered out
      expect(res.rates["1inch"]).toBeUndefined();
    });

    test("falls back to mirror URL when primary host fails", async () => {
      const mockPayload = {
        date: "2026-11-24",
        usd: {
          eur: 0.915,
          pkr: 277.1,
        },
      };

      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("Primary CDN host unreachable"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockPayload,
        });

      const res = await currencyApiCdn.fetchRates("USD");
      expect(res.provider).toBe("currency_api_cdn");
      expect(res.rates.EUR).toBe(0.915);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    test("fails when both primary and mirror hosts fail", async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("Primary host 500"))
        .mockRejectedValueOnce(new Error("Mirror host 503"));

      await expect(currencyApiCdn.fetchRates("USD")).rejects.toThrow(
        /\[currency_api_cdn\] Both primary and mirror hosts failed/
      );
    });
  });
});
