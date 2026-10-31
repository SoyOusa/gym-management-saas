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

    test("Dashboard overview requires authentication", async () => {
        const response = await request(app)
            .get("/api/dashboard/overview");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });

    test("Dashboard overview rejects invalid JWT", async () => {
        const response = await request(app)
            .get("/api/dashboard/overview")
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: invalid token",
        });
    });

    test("Membership list requires authentication", async () => {
        const response = await request(app)
            .get("/api/memberships");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });

    test("Membership list rejects invalid JWT", async () => {
        const response = await request(app)
            .get("/api/memberships")
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: invalid token",
        });
    });

    test("Membership renewal requires authentication", async () => {
        const membershipId = "507f1f77bcf86cd799439027";

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });

    test("Membership renewal rejects invalid JWT", async () => {
        const membershipId = "507f1f77bcf86cd799439032";

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: invalid token",
        });
    });
});