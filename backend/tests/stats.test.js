const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Stats Routes", () => {
  test("GET /api/stats/summary returns aggregate metrics and X-DB-Served-By header", async () => {
    const res = await request(BASE_URL).get("/api/stats/summary");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBeDefined();

    expect(res.body).toHaveProperty("userCount");
    expect(res.body).toHaveProperty("orderCount");
    expect(res.body).toHaveProperty("productCount");
    expect(res.body).toHaveProperty("totalRevenue");
    expect(res.body).toHaveProperty("avgOrderValue");

    expect(Number(res.body.userCount)).toBeGreaterThanOrEqual(10);
    expect(Number(res.body.orderCount)).toBeGreaterThanOrEqual(20);
    expect(Number(res.body.productCount)).toBeGreaterThanOrEqual(15);
    expect(Number(res.body.totalRevenue)).toBeGreaterThan(0);
  });
});
