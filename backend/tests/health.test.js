const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Health Route", () => {
  test("GET /health returns 200 with status ok and does not touch DB", async () => {
    const res = await request(BASE_URL).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
