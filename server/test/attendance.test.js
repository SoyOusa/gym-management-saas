
const request = require("supertest");
const jwt = require("jsonwebtoken");

// Mock the User model so tests do not query MongoDB.
jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

// Mock attendance controllers so no database records are changed.
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
const app = require("../app");

const secret = "test-jwt-secret";

const userId = "507f1f77bcf86cd799439091";
const classId = "507f1f77bcf86cd799439086";
const attendanceId = "507f1f77bcf86cd799439092";

// Create a JWT and mock an authenticated user.
function authenticateAs(role, isActive = true) {
    const token = jwt.sign({ id: userId }, secret);

    User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({
            _id: userId,
            role,
            isActive,
        }),
    });

    return token;
}

describe("Attendance authentication and authorization", () => {
    beforeEach(() => {
        process.env.JWT_SECRET = secret;
        jest.clearAllMocks();
    });

    // =====================================
    // POST /api/attendance
    // =====================================

    test("Unauthenticated user cannot record attendance", async () => {
        const response = await request(app)
            .post("/api/attendance")
            .send({
                classId,
                memberId: userId,
                status: "present",
            });

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            message: "Unauthorized: no token provided",
        });
    });

    test("Invalid JWT cannot record attendance", async () => {
        const response = await request(app)
            .post("/api/attendance")
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            message: "Unauthorized: invalid token",
        });
    });

    test("Admin can record attendance", async () => {
        const token = authenticateAs("admin");

        const response = await request(app)
            .post("/api/attendance")
            .set("Authorization", `Bearer ${token}`)
            .send({
                classId,
                memberId: userId,
                status: "present",
            });

        expect(response.statusCode).toBe(201);
        expect(response.body).toEqual({
            message: "Mock attendance recorded",
        });
    });

    test("Trainer can record attendance", async () => {
        const token = authenticateAs("trainer");

        const response = await request(app)
            .post("/api/attendance")
            .set("Authorization", `Bearer ${token}`)
            .send({
                classId,
                memberId: userId,
                status: "present",
            });

        expect(response.statusCode).toBe(201);
    });

    test("Member cannot record attendance", async () => {
        const token = authenticateAs("member");

        const response = await request(app)
            .post("/api/attendance")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
            message: "Forbidden: you do not have permission to access this resource",
        });
    });

    test("Inactive admin cannot record attendance", async () => {
        const token = authenticateAs("admin", false);

        const response = await request(app)
            .post("/api/attendance")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    test("Deleted trainer cannot record attendance", async () => {
        const token = jwt.sign({ id: userId }, secret);

        User.findById.mockReturnValue({
            select: jest.fn().mockResolvedValue(null),
        });

        const response = await request(app)
            .post("/api/attendance")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(401);
        expect(response.body).toEqual({
            message: "Unauthorized: user not found",
        });
    });

    // =====================================
    // GET /api/attendance/me
    // =====================================

    test("Unauthenticated user cannot view personal attendance", async () => {
        const response = await request(app)
            .get("/api/attendance/me");

        expect(response.statusCode).toBe(401);
    });

    test("Invalid JWT cannot view personal attendance", async () => {
        const response = await request(app)
            .get("/api/attendance/me")
            .set("Authorization", "Bearer invalid-token");

        expect(response.statusCode).toBe(401);
    });

    test("Member can view personal attendance", async () => {
        const token = authenticateAs("member");

        const response = await request(app)
            .get("/api/attendance/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            attendance: [],
        });
    });

    test("Admin cannot view member-only attendance history", async () => {
        const token = authenticateAs("admin");

        const response = await request(app)
            .get("/api/attendance/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
    });

    test("Trainer cannot view member-only attendance history", async () => {
        const token = authenticateAs("trainer");

        const response = await request(app)
            .get("/api/attendance/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
    });

    test("Inactive member cannot view personal attendance", async () => {
        const token = authenticateAs("member", false);

        const response = await request(app)
            .get("/api/attendance/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    // =====================================
    // GET /api/attendance/class/:classId
    // =====================================

    test("Unauthenticated user cannot view class attendance", async () => {
        const response = await request(app)
            .get(`/api/attendance/class/${classId}`);

        expect(response.statusCode).toBe(401);
    });

    test("Admin can view class attendance", async () => {
        const token = authenticateAs("admin");

        const response = await request(app)
            .get(`/api/attendance/class/${classId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            attendance: [],
        });
    });

    test("Trainer can view class attendance", async () => {
        const token = authenticateAs("trainer");

        const response = await request(app)
            .get(`/api/attendance/class/${classId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
    });

    test("Member cannot view class attendance", async () => {
        const token = authenticateAs("member");

        const response = await request(app)
            .get(`/api/attendance/class/${classId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
    });

    test("Inactive trainer cannot view class attendance", async () => {
        const token = authenticateAs("trainer", false);

        const response = await request(app)
            .get(`/api/attendance/class/${classId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    // =====================================
    // PATCH /api/attendance/:id
    // =====================================

    test("Unauthenticated user cannot update attendance", async () => {
        const response = await request(app)
            .patch(`/api/attendance/${attendanceId}`)
            .send({ status: "absent" });

        expect(response.statusCode).toBe(401);
    });

    test("Admin can update attendance", async () => {
        const token = authenticateAs("admin");

        const response = await request(app)
            .patch(`/api/attendance/${attendanceId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "absent" });

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            message: "Mock attendance updated",
        });
    });

    test("Trainer can update attendance", async () => {
        const token = authenticateAs("trainer");

        const response = await request(app)
            .patch(`/api/attendance/${attendanceId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "present" });

        expect(response.statusCode).toBe(200);
    });

    test("Member cannot update attendance", async () => {
        const token = authenticateAs("member");

        const response = await request(app)
            .patch(`/api/attendance/${attendanceId}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ status: "present" });

        expect(response.statusCode).toBe(403);
    });

    test("Inactive admin cannot update attendance", async () => {
        const token = authenticateAs("admin", false);

        const response = await request(app)
            .patch(`/api/attendance/${attendanceId}`)
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
        expect(response.body).toEqual({
            message: "Account is inactive",
        });
    });

    // =====================================
    // GET /api/attendance/summary
    // =====================================

    test("Unauthenticated user cannot view attendance summary", async () => {
        const response = await request(app)
            .get("/api/attendance/summary");

        expect(response.statusCode).toBe(401);
    });

    test("Admin can view attendance summary", async () => {
        const token = authenticateAs("admin");

        const response = await request(app)
            .get("/api/attendance/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(200);
        expect(response.body).toEqual({
            totalAttendance: 0,
        });
    });

    test("Member cannot view attendance summary", async () => {
        const token = authenticateAs("member");

        const response = await request(app)
            .get("/api/attendance/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
    });

    test("Trainer cannot view attendance summary", async () => {
        const token = authenticateAs("trainer");

        const response = await request(app)
            .get("/api/attendance/summary")
            .set("Authorization", `Bearer ${token}`);

        expect(response.statusCode).toBe(403);
    });
});
