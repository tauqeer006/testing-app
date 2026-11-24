const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Audit Routes", () => {
  test("POST /api/audit calls stored procedure add_audit_log on writePool", async () => {
    const res = await request(BASE_URL)
      .post("/api/audit")
      .send({ message: "Automated test audit log entry" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/Audit log entry created/i);
  });

  test("POST /api/audit without message returns 400 Bad Request", async () => {
    const res = await request(BASE_URL)
      .post("/api/audit")
      .send({});

    expect(res.status).toBe(400);
  });
});
