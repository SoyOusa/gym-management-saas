
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

jest.mock("../controllers/membershipController", () => ({
    createMembership: jest.fn((req, res) => {
        res.status(201).json({
            message: "Mock membership created",
        });
    }),

    getMyMemberships: jest.fn((req, res) => {
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

    renewMembership: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock membership renewed",
        });
    }),
}));

const User = require("../models/User");
const controller = require("../controllers/membershipController");
const membershipRoutes = require("../routes/membershipRoutes");

const app = express();
app.use(express.json());
app.use("/api/memberships", membershipRoutes);

const secret = "membership-routes-test-secret";
const userId = "507f1f77bcf86cd799439111";
const membershipId = "507f1f77bcf86cd799439112";

const endpoints = [
    {
        name: "create membership",
        method: "post",
        path: "/api/memberships",
        handler: "createMembership",
        successStatus: 201,
        allowedRoles: ["admin", "trainer", "member"],
    },
    {
        name: "list memberships",
        method: "get",
        path: "/api/memberships",
        handler: "getMyMemberships",
        successStatus: 200,
        allowedRoles: ["admin", "trainer", "member"],
    },
    {
        name: "view membership",
        method: "get",
        path: `/api/memberships/${membershipId}`,
        handler: "getMembershipById",
        successStatus: 200,
        allowedRoles: ["admin", "trainer", "member"],
    },
    {
        name: "update membership",
        method: "patch",
        path: `/api/memberships/${membershipId}`,
        handler: "updateMembership",
        successStatus: 200,
        allowedRoles: ["admin", "trainer", "member"],
    },
    {
        name: "cancel membership",
        method: "patch",
        path: `/api/memberships/${membershipId}/cancel`,
        handler: "cancelMembership",
        successStatus: 200,
        allowedRoles: ["admin", "trainer", "member"],
    },
    {
        name: "renew membership",
        method: "patch",
        path: `/api/memberships/${membershipId}/renew`,
        handler: "renewMembership",
        successStatus: 200,
        allowedRoles: ["member"],
    },
    {
        name: "delete membership",
        method: "delete",
        path: `/api/memberships/${membershipId}`,
        handler: "deleteMembership",
        successStatus: 200,
        allowedRoles: ["admin", "trainer", "member"],
    },
];

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

function tokenForRole(role, isActive = true) {
    User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
            _id: userId,
            role,
            isActive,
        }),
    });

    return jwt.sign({ id: userId }, secret);
}

describe("Membership Routes - Security", () => {
    const roles = ["admin", "trainer", "member"];

    // 21 tests: 3 roles x 7 endpoints
    test.each(
        endpoints.flatMap((endpoint) =>
            roles.map((role) => ({
                ...endpoint,
                role,
            }))
        )
    )(
        "$role access to $name",
        async ({
            method,
            path,
            handler,
            successStatus,
            allowedRoles,
            role,
        }) => {
            const token = tokenForRole(role);

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            if (allowedRoles.includes(role)) {
                expect(response.statusCode).toBe(successStatus);
                expect(controller[handler])
                    .toHaveBeenCalledTimes(1);
            } else {
                expect(response.statusCode).toBe(403);
                expect(controller[handler])
                    .not.toHaveBeenCalled();
            }
        }
    );

    // 7 tests: missing authentication
    test.each(endpoints)(
        "Missing token cannot $name",
        async ({ method, path, handler }) => {
            const response = await request(app)
                [method](path);

            expect(response.statusCode).toBe(401);
            expect(controller[handler])
                .not.toHaveBeenCalled();
        }
    );

    // 1 test: invalid renewal token
    test("Invalid token cannot renew membership", async () => {
        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);
        expect(controller.renewMembership)
            .not.toHaveBeenCalled();
    });

    // 1 test: inactive member
    test("Inactive member cannot renew membership", async () => {
        const token = tokenForRole("member", false);

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
            message: "Account is inactive",
        });
        expect(controller.renewMembership)
            .not.toHaveBeenCalled();
    });

    // 1 test: deleted member
    test("Deleted member cannot renew membership", async () => {
        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const token = jwt.sign({ id: userId }, secret);

        const response = await request(app)
            .patch(`/api/memberships/${membershipId}/renew`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
        expect(controller.renewMembership)
            .not.toHaveBeenCalled();
    });
});
