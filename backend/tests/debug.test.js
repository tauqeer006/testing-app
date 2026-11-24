const request = require("supertest");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

describe("Debug Route", () => {
  test("GET /debug/db returns read and write identities or error structure", async () => {
    const res = await request(BASE_URL).get("/debug/db");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("read");
    expect(res.body).toHaveProperty("write");

    if (res.body.read.identity) {
      expect(["PRIMARY", "SECONDARY"]).toContain(res.body.read.identity);
    } else {
      expect(res.body.read).toHaveProperty("error");
      expect(res.body.read).toHaveProperty("code");
    }

    if (res.body.write.identity) {
      expect(["PRIMARY", "SECONDARY"]).toContain(res.body.write.identity);
    } else {
      expect(res.body.write).toHaveProperty("error");
      expect(res.body.write).toHaveProperty("code");
    }
  });
});
