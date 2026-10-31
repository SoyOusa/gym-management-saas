jest.mock("../controllers/paymentController", () => ({
    createPayment: jest.fn((req, res) => {
        res.status(201).json({ message: "Mock payment created" });
    }),

    getAllPayments: jest.fn((req, res) => {
        res.status(200).json({ payments: [] });
    }),

    getPaymentById: jest.fn((req, res) => {
        res.status(200).json({ payment: {} });
    }),

    updatePaymentStatus: jest.fn((req, res) => {
        res.status(200).json({ message: "Mock payment updated" });
    }),

    getMyPayments: jest.fn((req, res) => {
        res.status(200).json({ payments: [] });
    }),

    getRevenueSummary: jest.fn((req, res) => {
        res.status(200).json({ totalRevenue: 0 });
    }),
}));

const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../controllers/dashboardController", () => ({
    getDashboardOverview: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock dashboard overview",
        });
    }),
}));

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));


jest.mock("../controllers/membershipController", () => ({
    createMembership: jest.fn(),
    getMyMemberships: jest.fn(),
    getMembershipById: jest.fn(),
    updateMembership: jest.fn(),
    deleteMembership: jest.fn(),
    cancelMembership: jest.fn(),

    renewMembership: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock membership renewal authorized",
        });
    }),
}));

const User = require("../models/User");
const app = require("../app");

describe("Role-based authorization", () => {
    test("Member cannot access admin payment endpoint", async () => {
        const secret = "test-jwt-secret";

        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439011" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439011",
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access admin payment endpoint", async () => {
        const secret = "test-jwt-secret";

        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439012" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439012",
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Inactive member cannot access payment history", async () => {
        const secret = "test-jwt-secret";

        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439013" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439013",
                role: "member",
                isActive: false,
            }),
        });

        const response = await request(app)
            .get("/api/payments/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });


    test("Deleted user cannot access payment history", async () => {
        const secret = "test-jwt-secret";

        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439014" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .get("/api/payments/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    test("Admin can access admin payment endpoint", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439015" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439015",
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            payments: [],
        });

    });

    test("Member can access their own payment history", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439016" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439016",
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            payments: [],
        });
    });

    test("Admin cannot access member-only payment history", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439017" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439017",
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access member-only payment history", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439018" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439018",
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Admin can access revenue summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439019" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439019",
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            totalRevenue: 0,
        });
    });

    test("Member cannot access revenue summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439020" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439020",
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access revenue summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439021" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439021",
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/payments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Member cannot access admin dashboard", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439022" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439022",
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/dashboard/overview")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access admin dashboard", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439023" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439023",
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/dashboard/overview")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });


    test("Admin can access dashboard overview", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439024" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439024",
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/dashboard/overview")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            message: "Mock dashboard overview",
        });
    });

    test("Inactive admin cannot access dashboard overview", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439025" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439025",
                role: "admin",
                isActive: false,
            }),
        });

        const response = await request(app)
            .get("/api/dashboard/overview")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    test("Deleted admin cannot access dashboard overview", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439026" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .get("/api/dashboard/overview")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    test("Admin cannot access membership renewal", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439028" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439028",
                role: "admin",
                isActive: true,
            }),
        });

        const membershipId = "507f1f77bcf86cd799439029";

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access membership renewal", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439030" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439030",
                role: "trainer",
                isActive: true,
            }),
        });

        const membershipId = "507f1f77bcf86cd799439031";

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Inactive member cannot renew membership", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439033" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439033",
                role: "member",
                isActive: false,
            }),
        });

        const membershipId = "507f1f77bcf86cd799439034";

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });
    
    test("Deleted member cannot renew membership", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439035" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const membershipId = "507f1f77bcf86cd799439036";

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    test("Active member can access membership renewal", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const token = jwt.sign(
            { id: "507f1f77bcf86cd799439037" },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: "507f1f77bcf86cd799439037",
                role: "member",
                isActive: true,
            }),
        });

        const membershipId = "507f1f77bcf86cd799439038";

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", `Bearer ${token}`);


        console.log("Renewal status:", response.statusCode);
        console.log("Renewal response:", response.body);
        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            message: "Mock membership renewal authorized",
        });
    });
});