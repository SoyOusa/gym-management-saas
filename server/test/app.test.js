const request = require("supertest");
const app = require("../app");

describe("Gym Management API", () => {
    test("GET / should return API status", async () => {
        const response = await request(app).get("/");

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            message: "GYM Management API is running",
        });
    });

    test("GET /api/payments/me should reject requests without a token", async () => {
        const response = await request(app).get("/api/payments/me");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });

    test("GET /api/payments/me should reject invalid token", async () => {
        const response = await request(app)
            .get("/api/payments/me")
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message:"Unauthorized: invalid token",
        })
    });

    test("GET /api/payments should reject requests without a token", async () => {
        const response = await request(app).get("/api/payments");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });

    test("GET /api/payments/summary should reject requests without a token", async () => {
        const response = await request(app).get("/api/payments/summary");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });
});