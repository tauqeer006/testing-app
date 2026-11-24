const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const EXPECTED_READ_DB = process.env.EXPECTED_READ_DB || "PRIMARY";

describe("Database Failover Verification", () => {
  test(`GET /api/users returns 200 and X-DB-Served-By equals ${EXPECTED_READ_DB}`, async () => {
    const res = await request(BASE_URL).get("/api/users");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe(EXPECTED_READ_DB);
  });

  test(`GET /api/users/1 returns 200 and X-DB-Served-By equals ${EXPECTED_READ_DB}`, async () => {
    const res = await request(BASE_URL).get("/api/users/1");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe(EXPECTED_READ_DB);
  });

  test(`GET /api/orders returns 200 and X-DB-Served-By equals ${EXPECTED_READ_DB}`, async () => {
    const res = await request(BASE_URL).get("/api/orders");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe(EXPECTED_READ_DB);
  });

  test(`GET /api/orders/1 returns 200 and X-DB-Served-By equals ${EXPECTED_READ_DB}`, async () => {
    const res = await request(BASE_URL).get("/api/orders/1");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe(EXPECTED_READ_DB);
  });

  test(`GET /api/products returns 200 and X-DB-Served-By equals ${EXPECTED_READ_DB}`, async () => {
    const res = await request(BASE_URL).get("/api/products");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe(EXPECTED_READ_DB);
  });

  test(`GET /api/products?minPrice=20 returns 200 and X-DB-Served-By equals ${EXPECTED_READ_DB}`, async () => {
    const res = await request(BASE_URL).get("/api/products?minPrice=20");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe(EXPECTED_READ_DB);
  });

  test(`GET /api/stats/summary returns 200 and X-DB-Served-By equals ${EXPECTED_READ_DB}`, async () => {
    const res = await request(BASE_URL).get("/api/stats/summary");
    expect(res.status).toBe(200);
    expect(res.headers["x-db-served-by"]).toBe(EXPECTED_READ_DB);
  });

  test("GET /debug/db confirms write identity remains PRIMARY", async () => {
    const res = await request(BASE_URL).get("/debug/db");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("write");
    expect(res.body.write.identity).toBe("PRIMARY");
  });
});
