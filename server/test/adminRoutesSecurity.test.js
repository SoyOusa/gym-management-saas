
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

jest.mock("../controllers/adminController", () => ({
    getDashboardStats: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock admin dashboard stats",
        });
    }),
}));

const User = require("../models/User");
const adminController = require("../controllers/adminController");
const adminRoutes = require("../routes/adminRoutes");

const app = express();
app.use(express.json());
app.use("/api/admin", adminRoutes);

const secret = "admin-route-test-secret";
const userId = "507f1f77bcf86cd799439096";

function mockUser(role, isActive = true) {
    User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
            _id: userId,
            role,
            isActive,
        }),
    });

    return jwt.sign({ id: userId }, secret);
}

beforeAll(() => {
    process.env.JWT_SECRET = secret;
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("Admin Routes - Security", () => {
    test("Active admin can access dashboard stats", async () => {
        const token = mockUser("admin");

        const response = await request(app)
            .get("/api/admin/dashboard")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            message: "Mock admin dashboard stats",
        });
        expect(adminController.getDashboardStats)
            .toHaveBeenCalledTimes(1);
    });

    test.each(["member", "trainer"])(
        "%s cannot access admin dashboard stats",
        async (role) => {
            const token = mockUser(role);

            const response = await request(app)
                .get("/api/admin/dashboard")
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(403);
            expect(response.body).toEqual({
                message:
                    "Forbidden: you do not have permission to access this resource",
            });
            expect(adminController.getDashboardStats)
                .not.toHaveBeenCalled();
        }
    );

    test("Missing token cannot access admin dashboard stats", async () => {
        const response = await request(app)
            .get("/api/admin/dashboard");

        expect(response.statusCode).toBe(401);
        expect(adminController.getDashboardStats)
            .not.toHaveBeenCalled();
    });

    test("Invalid token cannot access admin dashboard stats", async () => {
        const response = await request(app)
            .get("/api/admin/dashboard")
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);
        expect(adminController.getDashboardStats)
            .not.toHaveBeenCalled();
    });

    test("Inactive admin cannot access dashboard stats", async () => {
        const token = mockUser("admin", false);

        const response = await request(app)
            .get("/api/admin/dashboard")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
            message: "Account is inactive",
        });
        expect(adminController.getDashboardStats)
            .not.toHaveBeenCalled();
    });

    test("Deleted admin cannot access dashboard stats", async () => {
        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const token = jwt.sign({ id: userId }, secret);

        const response = await request(app)
            .get("/api/admin/dashboard")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
        expect(adminController.getDashboardStats)
            .not.toHaveBeenCalled();
    });
});
