
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

jest.mock("../controllers/adminMembershipController", () => ({
    getAllMemberships: jest.fn((req, res) => {
        res.status(200).json({ memberships: [] });
    }),

    getMembershipById: jest.fn((req, res) => {
        res.status(200).json({
            membership: { id: req.params.id },
        });
    }),

    updateMembership: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock membership updated",
        });
    }),

    deleteMembership: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock membership deleted",
        });
    }),

    cancelMembership: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock membership cancelled",
        });
    }),
}));

const User = require("../models/User");
const controller = require("../controllers/adminMembershipController");
const adminMembershipRoutes = require("../routes/adminMembershipRoutes");

const app = express();
app.use(express.json());

// Isolated test mount. The production mount path may differ.
app.use("/api/admin", adminMembershipRoutes);

const secret = "admin-membership-test-secret";
const userId = "507f1f77bcf86cd799439096";
const membershipId = "507f1f77bcf86cd799439097";

const endpoints = [
    {
        name: "list memberships",
        method: "get",
        path: "/api/admin/memberships",
        controller: "getAllMemberships",
    },
    {
        name: "view a membership",
        method: "get",
        path: `/api/admin/memberships/${membershipId}`,
        controller: "getMembershipById",
    },
    {
        name: "update a membership",
        method: "patch",
        path: `/api/admin/memberships/${membershipId}`,
        controller: "updateMembership",
    },
    {
        name: "delete a membership",
        method: "delete",
        path: `/api/admin/memberships/${membershipId}`,
        controller: "deleteMembership",
    },
    {
        name: "cancel a membership",
        method: "patch",
        path: `/api/admin/memberships/${membershipId}/cancel`,
        controller: "cancelMembership",
    },
];

function tokenForRole(role) {
    User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
            _id: userId,
            role,
            isActive: true,
        }),
    });

    return jwt.sign({ id: userId }, secret);
}

const originalSecret = process.env.JWT_SECRET;

beforeAll(() => {
    process.env.JWT_SECRET = secret;
});

afterAll(() => {
    if (originalSecret === undefined) {
        delete process.env.JWT_SECRET;
    } else {
        process.env.JWT_SECRET = originalSecret;
    }
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("Admin Membership Routes - Security", () => {
    test.each(endpoints)(
        "Admin can $name",
        async ({ method, path, controller: handler }) => {
            const token = tokenForRole("admin");

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(200);
            expect(controller[handler]).toHaveBeenCalledTimes(1);
        }
    );

    test.each(endpoints)(
        "Member cannot $name",
        async ({ method, path, controller: handler }) => {
            const token = tokenForRole("member");

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(403);
            expect(response.body).toEqual({
                message:
                    "Forbidden: you do not have permission to access this resource",
            });
            expect(controller[handler]).not.toHaveBeenCalled();
        }
    );

    test.each(endpoints)(
        "Trainer cannot $name",
        async ({ method, path, controller: handler }) => {
            const token = tokenForRole("trainer");

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(403);
            expect(controller[handler]).not.toHaveBeenCalled();
        }
    );

    test.each(endpoints)(
        "Missing token cannot $name",
        async ({ method, path, controller: handler }) => {
            const response = await request(app)
                [method](path);

            expect(response.statusCode).toBe(401);
            expect(controller[handler]).not.toHaveBeenCalled();
        }
    );

    test.each(endpoints)(
        "Invalid token cannot $name",
        async ({ method, path, controller: handler }) => {
            const response = await request(app)
                [method](path)
                .set("Authorization", "Bearer invalid-token");

            expect(response.statusCode).toBe(401);
            expect(controller[handler]).not.toHaveBeenCalled();
        }
    );
});
