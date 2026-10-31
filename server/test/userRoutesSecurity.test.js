
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

jest.mock("../controllers/userController", () => ({
    getAllUsers: jest.fn((req, res) => {
        res.status(200).json({ users: [] });
    }),
    getUserById: jest.fn((req, res) => {
        res.status(200).json({
            user: { id: req.params.id },
        });
    }),
    updateUser: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock user updated",
        });
    }),
}));

const User = require("../models/User");
const userController = require("../controllers/userController");
const userRoutes = require("../routes/userRoutes");

const app = express();
app.use(express.json());
app.use("/api/users", userRoutes);

const secret = "user-route-test-secret";
const userId = "507f1f77bcf86cd799439091";

const endpoints = [
    {
        name: "list users",
        method: "get",
        path: "/api/users",
        controller: "getAllUsers",
        successStatus: 200,
    },
    {
        name: "view user",
        method: "get",
        path: `/api/users/${userId}`,
        controller: "getUserById",
        successStatus: 200,
    },
    {
        name: "update user",
        method: "patch",
        path: `/api/users/${userId}`,
        controller: "updateUser",
        successStatus: 200,
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

beforeAll(() => {
    process.env.JWT_SECRET = secret;
});

beforeEach(() => {
    jest.clearAllMocks();
});

describe("User Routes - Security", () => {
    test.each(endpoints)(
        "Allows admin to $name",
        async ({ method, path, controller, successStatus }) => {
            const token = tokenForRole("admin");

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(successStatus);
            expect(userController[controller])
                .toHaveBeenCalledTimes(1);
        }
    );

    test.each(endpoints)(
        "Rejects member attempting to $name",
        async ({ method, path, controller }) => {
            const token = tokenForRole("member");

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(403);
            expect(response.body).toEqual({
                message:
                    "Forbidden: you do not have permission to access this resource",
            });
            expect(userController[controller])
                .not.toHaveBeenCalled();
        }
    );

    test.each(endpoints)(
        "Rejects trainer attempting to $name",
        async ({ method, path, controller }) => {
            const token = tokenForRole("trainer");

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(403);
            expect(userController[controller])
                .not.toHaveBeenCalled();
        }
    );

    test.each(endpoints)(
        "Rejects missing token when attempting to $name",
        async ({ method, path, controller }) => {
            const response = await request(app)
                [method](path);

            expect(response.statusCode).toBe(401);
            expect(response.body).toEqual({
                message: "Unauthorized: no token provided",
            });
            expect(userController[controller])
                .not.toHaveBeenCalled();
        }
    );

    test.each(endpoints)(
        "Rejects invalid token when attempting to $name",
        async ({ method, path, controller }) => {
            const response = await request(app)
                [method](path)
                .set("Authorization", "Bearer invalid-token");

            expect(response.statusCode).toBe(401);
            expect(response.body).toEqual({
                message: "Unauthorized: invalid token",
            });
            expect(userController[controller])
                .not.toHaveBeenCalled();
        }
    );
});
