
jest.mock("jsonwebtoken", () => ({
    verify: jest.fn(),
}));

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const User = require("../models/User");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const userId = "507f1f77bcf86cd799439091";

function mockRequest(authorization) {
    return {
        headers: authorization === undefined
            ? {}
            : { authorization },
    };
}

function mockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function mockActiveUser(role = "member") {
    return {
        _id: userId,
        role,
        isActive: true,
    };
}

function setupValidToken(role = "member") {
    jwt.verify.mockReturnValue({ id: userId });

    const user = mockActiveUser(role);
    const select = jest.fn().mockResolvedValue(user);

    User.findById.mockReturnValue({ select });

    return { user, select };
}

beforeEach(() => {
    jest.resetAllMocks();

    jest.spyOn(console, "error")
        .mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("Auth Middleware - protect", () => {
    test("Rejects request without Authorization header", async () => {
        const req = mockRequest();
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Unauthorized: no token provided",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects Authorization header without Bearer prefix", async () => {
        const req = mockRequest("abc123");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(jwt.verify).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects Basic authentication", async () => {
        const req = mockRequest("Basic abc123");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects malformed bearer token", async () => {
        jwt.verify.mockImplementation(() => {
            throw new Error("jwt malformed");
        });

        const req = mockRequest("Bearer malformed");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Unauthorized: invalid token",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects expired JWT", async () => {
        jwt.verify.mockImplementation(() => {
            const error = new Error("jwt expired");
            error.name = "TokenExpiredError";
            throw error;
        });

        const req = mockRequest("Bearer expired-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Unauthorized: invalid token",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects JWT with invalid signature", async () => {
        jwt.verify.mockImplementation(() => {
            const error = new Error("invalid signature");
            error.name = "JsonWebTokenError";
            throw error;
        });

        const req = mockRequest("Bearer bad-signature");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects token belonging to deleted user", async () => {
        jwt.verify.mockReturnValue({ id: userId });

        const select = jest.fn().mockResolvedValue(null);
        User.findById.mockReturnValue({ select });

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(User.findById).toHaveBeenCalledWith(userId);
        expect(select).toHaveBeenCalledWith("-password");

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Unauthorized: user not found",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects inactive user", async () => {
        jwt.verify.mockReturnValue({ id: userId });

        const select = jest.fn().mockResolvedValue({
            ...mockActiveUser(),
            isActive: false,
        });

        User.findById.mockReturnValue({ select });

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            message: "Account is inactive",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("Allows active member with valid JWT", async () => {
        setupValidToken("member");

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(req.user).toEqual({
            id: userId,
            role: "member",
        });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("Allows active admin with valid JWT", async () => {
        setupValidToken("admin");

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(req.user).toEqual({
            id: userId,
            role: "admin",
        });
        expect(next).toHaveBeenCalledTimes(1);
    });

    test("Allows active trainer with valid JWT", async () => {
        setupValidToken("trainer");

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(req.user).toEqual({
            id: userId,
            role: "trainer",
        });
        expect(next).toHaveBeenCalledTimes(1);
    });

    test("Verifies JWT using configured secret", async () => {
        setupValidToken();

        const previousSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = "middleware-test-secret";

        try {
            const req = mockRequest("Bearer abc123");
            const res = mockResponse();
            const next = jest.fn();

            await protect(req, res, next);

            expect(jwt.verify).toHaveBeenCalledWith(
                "abc123",
                "middleware-test-secret"
            );
        } finally {
            if (previousSecret === undefined) {
                delete process.env.JWT_SECRET;
            } else {
                process.env.JWT_SECRET = previousSecret;
            }
        }
    });

    test("Handles user lookup database failure", async () => {
        jwt.verify.mockReturnValue({ id: userId });

        const select = jest.fn().mockRejectedValue(
            new Error("Database failure")
        );

        User.findById.mockReturnValue({ select });

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
        expect(next).not.toHaveBeenCalled();
    });
});

describe("Auth Middleware - authorizeRoles", () => {
    function requestWithRole(role) {
        return {
            user: {
                id: userId,
                role,
            },
        };
    }

    test("Allows admin on admin-only route", () => {
        const middleware = authorizeRoles("admin");
        const req = requestWithRole("admin");
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test("Rejects member on admin-only route", () => {
        const middleware = authorizeRoles("admin");
        const req = requestWithRole("member");
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            message: "Forbidden: you do not have permission to access this resource",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects trainer on admin-only route", () => {
        const middleware = authorizeRoles("admin");
        const req = requestWithRole("trainer");
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test("Allows trainer on trainer/admin route", () => {
        const middleware = authorizeRoles("admin", "trainer");
        const req = requestWithRole("trainer");
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    test("Allows admin on trainer/admin route", () => {
        const middleware = authorizeRoles("admin", "trainer");
        const req = requestWithRole("admin");
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
    });

    test("Rejects member on trainer/admin route", () => {
        const middleware = authorizeRoles("admin", "trainer");
        const req = requestWithRole("member");
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects unknown role", () => {
        const middleware = authorizeRoles("admin");
        const req = requestWithRole("unknown");
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });   
});


describe("Auth Middleware - Security Hardening", () => {
    test("Rejects authorization when req.user is missing", () => {
        const middleware = authorizeRoles("admin");

        const req = {};
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Unauthorized: authentication required",
        });
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects authorization when req.user is null", () => {
        const middleware = authorizeRoles("admin");

        const req = { user: null };
        const res = mockResponse();
        const next = jest.fn();

        middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(next).not.toHaveBeenCalled();
    });

    test("Rejects empty Bearer token without verifying JWT", async () => {
        const req = mockRequest("Bearer ");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Unauthorized: invalid token",
        });
        expect(jwt.verify).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("Does not query database when JWT verification fails", async () => {
        jwt.verify.mockImplementation(() => {
            throw new Error("Invalid JWT");
        });

        const req = mockRequest("Bearer invalid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(User.findById).not.toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test("Does not attach req.user when database lookup fails", async () => {
        jwt.verify.mockReturnValue({ id: userId });

        const select = jest.fn().mockRejectedValue(
            new Error("Database unavailable")
        );

        User.findById.mockReturnValue({ select });

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(req.user).toBeUndefined();
        expect(next).not.toHaveBeenCalled();
    });

    test("Does not expose database error details to client", async () => {
        jwt.verify.mockReturnValue({ id: userId });

        const select = jest.fn().mockRejectedValue(
            new Error("Sensitive database connection details")
        );

        User.findById.mockReturnValue({ select });

        const req = mockRequest("Bearer valid-token");
        const res = mockResponse();
        const next = jest.fn();

        await protect(req, res, next);

        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });

        const response = res.json.mock.calls[0][0];

        expect(JSON.stringify(response)).not.toContain(
            "Sensitive database connection details"
        );
    });
});

