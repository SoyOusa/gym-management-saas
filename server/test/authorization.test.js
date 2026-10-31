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

jest.mock("../controllers/classController", () => ({
    createClass: jest.fn((req, res) => {
        res.status(201).json({
            message: "Mock class created",
        });
    }),

    getAllClasses: jest.fn((req, res) => {
        res.status(200).json({
            classes: [],
        });
    }),

    getClassById: jest.fn(),

    updateClass: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock class updated",
        });
    }),

    deleteClass: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock class deleted",
        });
    }),
}));

jest.mock("../controllers/enrollmentController", () => ({
    enrollInClass: jest.fn((req, res) => {
        res.status(201).json({
            message: "Mock enrollment created",
        });
    }),

    getMyEnrollments: jest.fn((req, res) => {
        res.status(200).json({
            enrollments: [],
        });
    }),

    cancelEnrollment: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock enrollment cancelled",
        });
    }),

    getAllEnrollments: jest.fn((req, res) => {
        res.status(200).json({
            enrollments: [],
        });
    }),

    getEnrollmentSummary: jest.fn((req, res) => {
        res.status(200).json({
            totalEnrollments: 0,
        });
    }),
        getEnrollmentById: jest.fn((req, res) => {
        res.status(200).json({
            enrollment: {
                _id: req.params.id,
            },
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
    test("Active member can view classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439039";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/classes")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            classes: [],
        });
    });

    test("Active trainer can view classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439040";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/classes")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            classes: [],
        });
    });

    test("Member cannot create classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439041";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .post("/api/classes")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Yoga Class",
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot create classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439042";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .post("/api/classes")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Yoga Class",
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });
    test("Admin can create classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439043";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .post("/api/classes")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Yoga Class",
            });

        expect(response.statusCode).toBe(201);

        expect(response.body).toEqual({
            message: "Mock class created",
        });
    });

    test("Inactive admin cannot create classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439044";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: false,
            }),
        });

        const response = await request(app)
            .post("/api/classes")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Yoga Class",
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });
    test("Deleted admin cannot create classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439045";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .post("/api/classes")
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Yoga Class",
            });

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    test("Member cannot delete classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439046";
        const classId = "507f1f77bcf86cd799439047";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .delete(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot delete classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439048";
        const classId = "507f1f77bcf86cd799439049";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .delete(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Admin can delete classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439050";
        const classId = "507f1f77bcf86cd799439051";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .delete(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            message: "Mock class deleted",
        });
    });

    test("Member cannot update classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439052";
        const classId = "507f1f77bcf86cd799439053";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .patch(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Updated Yoga Class",
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });


    test("Trainer cannot update classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439054";
        const classId = "507f1f77bcf86cd799439055";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .patch(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Updated Yoga Class",
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Admin can update classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439056";
        const classId = "507f1f77bcf86cd799439057";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .patch(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Updated Yoga Class",
            });

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            message: "Mock class updated",
        });
    });
    test("Inactive admin cannot update classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439058";
        const classId = "507f1f77bcf86cd799439059";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: false,
            }),
        });

        const response = await request(app)
            .patch(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Updated Yoga Class",
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    test("Deleted admin cannot update classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439060";
        const classId = "507f1f77bcf86cd799439061";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .patch(`/api/classes/${classId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({
                name: "Updated Yoga Class",
            });

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    test("Active member can enroll in a class", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439064";
        const classId = "507f1f77bcf86cd799439065";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .post("/api/enrollments")
            .set("Authorization", `Bearer ${token}`)
            .send({
                classId: classId,
            });

        expect(response.statusCode).toBe(201);

        expect(response.body).toEqual({
            message: "Mock enrollment created",
        });
    });

    test("Admin cannot enroll in classes as a member", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439066";
        const classId = "507f1f77bcf86cd799439067";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .post("/api/enrollments")
            .set("Authorization", `Bearer ${token}`)
            .send({
                classId: classId,
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot enroll in classes as a member", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439068";
        const classId = "507f1f77bcf86cd799439069";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .post("/api/enrollments")
            .set("Authorization", `Bearer ${token}`)
            .send({
                classId: classId,
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Inactive member cannot enroll in classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439070";
        const classId = "507f1f77bcf86cd799439071";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: false,
            }),
        });

        const response = await request(app)
            .post("/api/enrollments")
            .set("Authorization", `Bearer ${token}`)
            .send({
                classId: classId,
            });

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    test("Deleted member cannot enroll in classes", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439072";
        const classId = "507f1f77bcf86cd799439073";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .post("/api/enrollments")
            .set("Authorization", `Bearer ${token}`)
            .send({
                classId: classId,
            });

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });
    

    test("Active member can view their enrollments", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439074";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            enrollments: [],
        });
    });

    test("Admin cannot access member-only enrollment history", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439075";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access member-only enrollment history", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439076";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Admin can view all enrollments", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439077";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments/all")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            enrollments: [],
        });
    });

    test("Member cannot view all enrollments", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439078";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments/all")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot view all enrollments", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439079";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments/all")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Admin can access enrollment summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439080";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            totalEnrollments: 0,
        });
    });

    test("Member cannot access enrollment summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439081";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access enrollment summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439082";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Inactive admin cannot access enrollment summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439083";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: false,
            }),
        });

        const response = await request(app)
            .get("/api/enrollments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });


    test("Deleted admin cannot access enrollment summary", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439084";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .get("/api/enrollments/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    test("Active member can view a specific enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439085";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            enrollment: {
                _id: enrollmentId,
            },
        });
    });

    test("Admin cannot access a specific member enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439087";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot access a specific member enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439088";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .get(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Inactive member cannot access a specific enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439089";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: false,
            }),
        });

        const response = await request(app)
            .get(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    test("Deleted member cannot access a specific enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439090";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .get(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    test("Active member can cancel an enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439091";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: true,
            }),
        });

        const response = await request(app)
            .delete(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);

        expect(response.body).toEqual({
            message: "Mock enrollment cancelled",
        });
    });

    test("Admin cannot cancel a member enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439092";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "admin",
                isActive: true,
            }),
        });

        const response = await request(app)
            .delete(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Trainer cannot cancel a member enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439093";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "trainer",
                isActive: true,
            }),
        });

        const response = await request(app)
            .delete(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Inactive member cannot cancel an enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439094";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue({
                _id: userId,
                role: "member",
                isActive: false,
            }),
        });

        const response = await request(app)
            .delete(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);

        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    test("Deleted member cannot cancel an enrollment", async () => {
        const secret = "test-jwt-secret";
        process.env.JWT_SECRET = secret;

        const userId = "507f1f77bcf86cd799439095";
        const enrollmentId = "507f1f77bcf86cd799439086";

        const token = jwt.sign(
            { id: userId },
            secret
        );

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .delete(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });


    test("Unauthenticated user cannot cancel an enrollment", async () => {
        const enrollmentId = "507f1f77bcf86cd799439086";

        const response = await request(app)
            .delete(`/api/enrollments/${enrollmentId}`);

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });

    test("Invalid JWT cannot cancel an enrollment", async () => {
        const enrollmentId = "507f1f77bcf86cd799439086";

        const response = await request(app)
            .delete(`/api/enrollments/${enrollmentId}`)
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);

        expect(response.body).toEqual({
            message: "Unauthorized: invalid token",
        });
    });
});