
const mongoose = require("mongoose");

jest.mock("../models/Membership", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    deleteOne: jest.fn(),
}));

jest.mock("../models/Payment", () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

const Membership = require("../models/Membership");
const Payment = require("../models/Payment");
const membershipPlans = require("../config/membershipPlans");

const {
    createMembership,
    getMyMemberships,
    getMembershipById,
    updateMembership,
    deleteMembership,
    cancelMembership,
    renewMembership,
} = require("../controllers/membershipController");

const memberId = "507f1f77bcf86cd799439091";
const membershipId = "507f1f77bcf86cd799439092";

function mockRequest(body = {}, id = membershipId) {
    return {
        body,
        params: { id },
        user: { id: memberId, role: "member" },
    };
}

function mockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function validBody() {
    return {
        membershipType: "basic",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
    };
}

function membershipDocument(overrides = {}) {
    return {
        _id: membershipId,
        user: memberId,
        membershipType: "basic",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2099-12-31"),
        status: "active",
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Membership controller - createMembership", () => {
    test("Rejects invalid membership type", async () => {
        const res = mockResponse();

        await createMembership(
            mockRequest({
                ...validBody(),
                membershipType: "gold",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership type must be basic or premium",
        });
    });

    test("Rejects missing membership dates", async () => {
        const res = mockResponse();

        await createMembership(
            mockRequest({ membershipType: "basic" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Start date and end date are required",
        });
    });

    test("Rejects invalid membership dates", async () => {
        const res = mockResponse();

        await createMembership(
            mockRequest({
                ...validBody(),
                startDate: "invalid-date",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Start date and end date must be valid",
        });
    });

    test("Rejects end date before start date", async () => {
        const res = mockResponse();

        await createMembership(
            mockRequest({
                ...validBody(),
                endDate: "2025-12-31",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "End date must be after start",
        });
    });

    test("Rejects overlapping active membership", async () => {
        Membership.findOne.mockResolvedValue(
            membershipDocument()
        );

        const res = mockResponse();
        await createMembership(mockRequest(validBody()), res);

        expect(Membership.findOne).toHaveBeenCalledWith({
            user: memberId,
            status: "active",
            startDate: { $lt: new Date("2026-12-31") },
            endDate: { $gt: new Date("2026-01-01") },
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "You already have an active membership during this period",
        });
        expect(Membership.create).not.toHaveBeenCalled();
    });

    test("Successfully creates membership", async () => {
        Membership.findOne.mockResolvedValue(null);

        const membership = membershipDocument();
        Membership.create.mockResolvedValue(membership);

        const res = mockResponse();
        await createMembership(mockRequest(validBody()), res);

        expect(Membership.create).toHaveBeenCalledWith({
            user: memberId,
            ...validBody(),
        });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership created successfully",
            membership,
        });
    });
});

describe("Membership controller - getMyMemberships", () => {
    test("Returns member's memberships", async () => {
        const memberships = [
            membershipDocument(),
        ];

        Membership.find.mockResolvedValue(memberships);

        const res = mockResponse();
        await getMyMemberships(mockRequest(), res);

        expect(Membership.find).toHaveBeenCalledWith({
            user: memberId,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            memberships,
        });
    });

    test("Automatically expires past active memberships", async () => {
        const expiredMembership = membershipDocument({
            endDate: new Date("2020-01-01"),
        });

        Membership.find.mockResolvedValue([expiredMembership]);

        const res = mockResponse();
        await getMyMemberships(mockRequest(), res);

        expect(expiredMembership.status).toBe("expired");
        expect(expiredMembership.save).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("Does not modify inactive memberships", async () => {
        const membership = membershipDocument({
            status: "inactive",
            endDate: new Date("2020-01-01"),
        });

        Membership.find.mockResolvedValue([membership]);

        const res = mockResponse();
        await getMyMemberships(mockRequest(), res);

        expect(membership.status).toBe("inactive");
        expect(membership.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe("Membership controller - getMembershipById", () => {
    test("Rejects invalid membership ID", async () => {
        const res = mockResponse();

        await getMembershipById(
            mockRequest({}, "invalid-id"),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid membership ID",
        });
    });

    test("Returns 404 when membership is not found", async () => {
        Membership.findOne.mockResolvedValue(null);

        const res = mockResponse();
        await getMembershipById(mockRequest(), res);

        expect(Membership.findOne).toHaveBeenCalledWith({
            _id: membershipId,
            user: memberId,
        });
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Returns member's membership", async () => {
        const membership = membershipDocument();
        Membership.findOne.mockResolvedValue(membership);

        const res = mockResponse();
        await getMembershipById(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            membership,
        });
    });
});


describe("Membership controller - updateMembership", () => {
    const blockedMessage =
        "Membership plan and dates cannot be changed directly. Please use the approved payment or admin process.";

    const updateRequests = [
        {
            name: "invalid membership ID",
            id: "invalid-id",
            body: { membershipType: "premium" },
        },
        {
            name: "invalid membership type",
            id: "507f1f77bcf86cd799439011",
            body: { membershipType: "gold" },
        },
        {
            name: "direct status change",
            id: "507f1f77bcf86cd799439011",
            body: { status: "active" },
        },
        {
            name: "nonexistent membership ID",
            id: "507f1f77bcf86cd799439099",
            body: { membershipType: "premium" },
        },
        {
            name: "invalid updated date",
            id: "507f1f77bcf86cd799439011",
            body: { endDate: "invalid-date" },
        },
        {
            name: "end date before start date",
            id: "507f1f77bcf86cd799439011",
            body: {
                startDate: "2026-12-31",
                endDate: "2026-01-01",
            },
        },
        {
            name: "membership plan upgrade",
            id: "507f1f77bcf86cd799439011",
            body: { membershipType: "premium" },
        },
    ];

    test.each(updateRequests)(
        "Blocks $name with 403",
        async ({ id, body }) => {
            const req = {
                params: { id },
                body,
                user: {
                    id: "507f1f77bcf86cd799439010",
                    role: "member",
                },
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn().mockReturnThis(),
            };

            await updateMembership(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                message: blockedMessage,
            });
        }
    );
});


describe("Membership controller - deleteMembership", () => {
    test("Rejects invalid membership ID", async () => {
        const res = mockResponse();

        await deleteMembership(
            mockRequest({}, "invalid"),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Returns 404 when membership is not found", async () => {
        Membership.findOne.mockResolvedValue(null);

        const res = mockResponse();
        await deleteMembership(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(404);
    });

    test("Successfully deletes owned membership", async () => {
        Membership.findOne.mockResolvedValue(
            membershipDocument()
        );
        Membership.deleteOne.mockResolvedValue({
            deletedCount: 1,
        });

        const res = mockResponse();
        await deleteMembership(mockRequest(), res);

        expect(Membership.deleteOne).toHaveBeenCalledWith({
            _id: membershipId,
            user: memberId,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership deleted successfully",
        });
    });
});

describe("Membership controller - cancelMembership", () => {
    test("Rejects invalid membership ID", async () => {
        const res = mockResponse();

        await cancelMembership(
            mockRequest({}, "invalid"),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Rejects cancellation of inactive membership", async () => {
        Membership.findOne.mockResolvedValue(
            membershipDocument({ status: "inactive" })
        );

        const res = mockResponse();
        await cancelMembership(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership is already inactive",
        });
    });

    test("Successfully cancels active membership", async () => {
        const membership = membershipDocument();
        Membership.findOne.mockResolvedValue(membership);

        const res = mockResponse();
        await cancelMembership(mockRequest(), res);

        expect(membership.status).toBe("inactive");
        expect(membership.save).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership cancelled successfully",
            membership,
        });
    });
});

describe("Membership controller - renewMembership", () => {
    test("Rejects invalid membership ID", async () => {
        const res = mockResponse();

        await renewMembership(
            mockRequest({ months: 3 }, "invalid"),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Rejects invalid renewal months", async () => {
        const res = mockResponse();

        await renewMembership(
            mockRequest({ months: 13 }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Months must be an integer between 1 and 12",
        });
    });

    test("Creates pending renewal payment with correct price", async () => {
        const membership = membershipDocument();
        Membership.findOne.mockResolvedValue(membership);
        Payment.findOne.mockResolvedValue(null);

        const plan = membershipPlans.basic;
        const payment = {
            _id: "507f1f77bcf86cd799439099",
            membership: membershipId,
            status: "pending",
        };

        Payment.create.mockResolvedValue(payment);

        const res = mockResponse();
        await renewMembership(
            mockRequest({ months: 3 }),
            res
        );

        expect(Payment.findOne).toHaveBeenCalledWith({
            membership: membershipId,
            purpose: "renewal",
            status: "pending",
        });

        expect(Payment.create).toHaveBeenCalledWith({
            member: memberId,
            membership: membershipId,
            purpose: "renewal",
            renewalMonths: 3,
            amount: plan.monthlyPrice * 3,
            currency: plan.currency,
            paymentMethod: "bank_transfer",
            status: "pending",
        });

        expect(membership.save).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Renewal payment created successfully",
            payment,
        });
    });
});
