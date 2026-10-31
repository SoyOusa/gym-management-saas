
const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

jest.mock("../controllers/attendanceController", () => ({
    markAttendance: jest.fn((req, res) => {
        res.status(201).json({
            message: "Mock attendance recorded",
        });
    }),

    getMyAttendance: jest.fn((req, res) => {
        res.status(200).json({
            attendance: [],
        });
    }),

    getClassAttendance: jest.fn((req, res) => {
        res.status(200).json({
            attendance: [],
        });
    }),

    updateAttendance: jest.fn((req, res) => {
        res.status(200).json({
            message: "Mock attendance updated",
        });
    }),

    getAttendanceSummary: jest.fn((req, res) => {
        res.status(200).json({
            totalAttendance: 0,
        });
    }),
}));

const User = require("../models/User");
const controller = require("../controllers/attendanceController");
const attendanceRoutes = require("../routes/attendanceRoutes");

const app = express();
app.use(express.json());
app.use("/api/attendance", attendanceRoutes);

const secret = "attendance-routes-test-secret";
const userId = "507f1f77bcf86cd799439101";
const classId = "507f1f77bcf86cd799439102";
const attendanceId = "507f1f77bcf86cd799439103";

const endpoints = [
    {
        name: "record attendance",
        method: "post",
        path: "/api/attendance",
        handler: "markAttendance",
        allowedRoles: ["admin", "trainer"],
        successStatus: 201,
    },
    {
        name: "view personal attendance",
        method: "get",
        path: "/api/attendance/me",
        handler: "getMyAttendance",
        allowedRoles: ["member"],
        successStatus: 200,
    },
    {
        name: "view class attendance",
        method: "get",
        path: `/api/attendance/class/${classId}`,
        handler: "getClassAttendance",
        allowedRoles: ["admin", "trainer"],
        successStatus: 200,
    },
    {
        name: "update attendance",
        method: "patch",
        path: `/api/attendance/${attendanceId}`,
        handler: "updateAttendance",
        allowedRoles: ["admin", "trainer"],
        successStatus: 200,
    },
    {
        name: "view attendance summary",
        method: "get",
        path: "/api/attendance/summary",
        handler: "getAttendanceSummary",
        allowedRoles: ["admin"],
        successStatus: 200,
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

describe("Attendance Routes - Security", () => {
    const roles = ["admin", "trainer", "member"];

    // 15 tests: 3 roles x 5 endpoints
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
            allowedRoles,
            successStatus,
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
                expect(response.body).toEqual({
                    message:
                        "Forbidden: you do not have permission to access this resource",
                });
                expect(controller[handler])
                    .not.toHaveBeenCalled();
            }
        }
    );

    // 5 tests: missing token
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

    // 5 tests: invalid token
    test.each(endpoints)(
        "Invalid token cannot $name",
        async ({ method, path, handler }) => {
            const response = await request(app)
                [method](path)
                .set("Authorization", "Bearer invalid-token");

            expect(response.statusCode).toBe(401);
            expect(controller[handler])
                .not.toHaveBeenCalled();
        }
    );

    // 5 tests: inactive user with an otherwise permitted role
    test.each(endpoints)(
        "Inactive user cannot $name",
        async ({ method, path, handler, allowedRoles }) => {
            const token = tokenForRole(
                allowedRoles[0],
                false
            );

            const response = await request(app)
                [method](path)
                .set("Authorization", `Bearer ${token}`);

            expect(response.statusCode).toBe(403);
            expect(response.body).toEqual({
                message: "Account is inactive",
            });
            expect(controller[handler])
                .not.toHaveBeenCalled();
        }
    );
});
