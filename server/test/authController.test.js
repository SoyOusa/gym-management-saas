
jest.mock("../models/User", () => ({
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
}));

jest.mock("bcryptjs", () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}));

jest.mock("jsonwebtoken", () => ({
    sign: jest.fn(),
}));

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const {
    registerUser,
    loginUser,
    getProfile,
} = require("../controllers/authController");

const userId = "507f1f77bcf86cd799439091";

const validRegistration = {
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    password: "SecurePass123!",
    phone: "012345678",
};

const mockUser = {
    _id: userId,
    firstName: "John",
    lastName: "Doe",
    email: "john@example.com",
    password: "hashed-password",
    role: "member",
    phone: "012345678",
};

function mockRequest(body = {}) {
    return {
        body,
        user: { id: userId, role: "member" },
    };
}

function mockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

beforeEach(() => {
    jest.resetAllMocks();

    jest.spyOn(console, "error")
        .mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("Auth Controller - registerUser", () => {
    test.each([
        ["firstName"],
        ["lastName"],
        ["email"],
        ["password"],
    ])("Rejects missing %s", async (field) => {
        const body = { ...validRegistration };
        delete body[field];

        const res = mockResponse();

        await registerUser(mockRequest(body), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Please provide first name, last name, email, and password",
        });
        expect(User.create).not.toHaveBeenCalled();
    });

    test("Rejects duplicate email", async () => {
        User.findOne.mockResolvedValue(mockUser);

        const res = mockResponse();

        await registerUser(
            mockRequest(validRegistration),
            res
        );

        expect(User.findOne).toHaveBeenCalledWith({
            email: "john@example.com",
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "a user with this email already exists",
        });

        expect(bcrypt.hash).not.toHaveBeenCalled();
        expect(User.create).not.toHaveBeenCalled();
    });

    test("Hashes password with 12 salt rounds", async () => {
        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue("hashed-password");
        User.create.mockResolvedValue(mockUser);

        const res = mockResponse();

        await registerUser(
            mockRequest(validRegistration),
            res
        );

        expect(bcrypt.hash).toHaveBeenCalledWith(
            "SecurePass123!",
            12
        );

        expect(User.create).toHaveBeenCalledWith({
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            password: "hashed-password",
            phone: "012345678",
        });

        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("Does not expose password in registration response", async () => {
        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue("hashed-password");
        User.create.mockResolvedValue(mockUser);

        const res = mockResponse();

        await registerUser(
            mockRequest(validRegistration),
            res
        );

        expect(res.json).toHaveBeenCalledWith({
            message: "User registered successfully",
            user: {
                id: userId,
                firstName: "John",
                lastName: "Doe",
                email: "john@example.com",
                role: "member",
            },
        });

        const response = res.json.mock.calls[0][0];
        expect(response.user.password).toBeUndefined();
    });

    test("Allows registration without optional phone", async () => {
        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue("hashed-password");
        User.create.mockResolvedValue(mockUser);

        const { phone, ...body } = validRegistration;

        const res = mockResponse();

        await registerUser(mockRequest(body), res);

        expect(User.create).toHaveBeenCalledWith(
            expect.objectContaining({
                phone: undefined,
            })
        );

        expect(res.status).toHaveBeenCalledWith(201);
    });

    test("Handles database lookup failure", async () => {
        User.findOne.mockRejectedValue(
            new Error("Database error")
        );

        const res = mockResponse();

        await registerUser(
            mockRequest(validRegistration),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
    });

    test("Handles password hashing failure", async () => {
        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockRejectedValue(
            new Error("Hashing error")
        );

        const res = mockResponse();

        await registerUser(
            mockRequest(validRegistration),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(User.create).not.toHaveBeenCalled();
    });

    test("Handles user creation failure", async () => {
        User.findOne.mockResolvedValue(null);
        bcrypt.hash.mockResolvedValue("hashed-password");
        User.create.mockRejectedValue(
            new Error("Create error")
        );

        const res = mockResponse();

        await registerUser(
            mockRequest(validRegistration),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
    });
});

describe("Auth Controller - loginUser", () => {
    test("Rejects missing email", async () => {
        const res = mockResponse();

        await loginUser(
            mockRequest({ password: "SecurePass123!" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Please provide email and password",
        });
    });

    test("Rejects missing password", async () => {
        const res = mockResponse();

        await loginUser(
            mockRequest({ email: "john@example.com" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(User.findOne).not.toHaveBeenCalled();
    });

    test("Rejects unknown email", async () => {
        User.findOne.mockResolvedValue(null);

        const res = mockResponse();

        await loginUser(
            mockRequest({
                email: "unknown@example.com",
                password: "password",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid email or password",
        });

        expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    test("Rejects incorrect password", async () => {
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(false);

        const res = mockResponse();

        await loginUser(
            mockRequest({
                email: "john@example.com",
                password: "wrong-password",
            }),
            res
        );

        expect(bcrypt.compare).toHaveBeenCalledWith(
            "wrong-password",
            "hashed-password"
        );

        expect(res.status).toHaveBeenCalledWith(401);
        expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("Generates JWT with user ID, role, and one-hour expiration", async () => {
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue("mock-jwt-token");

        const previousSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = "test-secret";

        try {
            const res = mockResponse();

            await loginUser(
                mockRequest({
                    email: "john@example.com",
                    password: "SecurePass123!",
                }),
                res
            );

            expect(jwt.sign).toHaveBeenCalledWith(
                {
                    id: userId,
                    role: "member",
                },
                "test-secret",
                { expiresIn: "1h" }
            );

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Login successful",
                    token: "mock-jwt-token",
                })
            );
        } finally {
            if (previousSecret === undefined) {
                delete process.env.JWT_SECRET;
            } else {
                process.env.JWT_SECRET = previousSecret;
            }
        }
    });

    test("Does not expose password in login response", async () => {
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue("mock-jwt-token");

        const res = mockResponse();

        await loginUser(
            mockRequest({
                email: "john@example.com",
                password: "SecurePass123!",
            }),
            res
        );

        const response = res.json.mock.calls[0][0];

        expect(response.user.password).toBeUndefined();
        expect(response.user).toEqual({
            id: userId,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            role: "member",
        });
    });

    test("Handles user lookup failure", async () => {
        User.findOne.mockRejectedValue(
            new Error("Database error")
        );

        const res = mockResponse();

        await loginUser(
            mockRequest({
                email: "john@example.com",
                password: "password",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
    });

    test("Handles password comparison failure", async () => {
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockRejectedValue(
            new Error("Compare error")
        );

        const res = mockResponse();

        await loginUser(
            mockRequest({
                email: "john@example.com",
                password: "password",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(jwt.sign).not.toHaveBeenCalled();
    });

    test("Handles JWT signing failure", async () => {
        User.findOne.mockResolvedValue(mockUser);
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockImplementation(() => {
            throw new Error("JWT error");
        });

        const res = mockResponse();

        await loginUser(
            mockRequest({
                email: "john@example.com",
                password: "password",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
    });
});

describe("Auth Controller - getProfile", () => {
    test("Returns authenticated user's profile", async () => {
        const { password, ...safeUser } = mockUser;

        const select = jest.fn().mockResolvedValue(safeUser);

        User.findById.mockReturnValue({ select });

        const res = mockResponse();

        await getProfile(mockRequest(), res);

        expect(User.findById).toHaveBeenCalledWith(userId);
        expect(select).toHaveBeenCalledWith("-password");

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            user: safeUser,
        });
    });

    test("Returns 404 when user is not found", async () => {
        const select = jest.fn().mockResolvedValue(null);

        User.findById.mockReturnValue({ select });

        const res = mockResponse();

        await getProfile(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "User not found",
        });
    });

    test("Handles profile lookup failure", async () => {
        const select = jest.fn().mockRejectedValue(
            new Error("Database error")
        );

        User.findById.mockReturnValue({ select });

        const res = mockResponse();

        await getProfile(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
    });
});
