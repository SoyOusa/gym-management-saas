
const mongoose = require("mongoose");

jest.mock("../models/Payment", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOneAndUpdate: jest.fn(),
    aggregate: jest.fn(),
}));

jest.mock("../models/Membership", () => ({
    findById: jest.fn(),
}));

const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const membershipPlans = require("../config/membershipPlans");

const {
    createPayment,
    getAllPayments,
    getPaymentById,
    updatePaymentStatus,
    getMyPayments,
    getRevenueSummary,
} = require("../controllers/paymentController");

const memberId = "507f1f77bcf86cd799439091";
const membershipId = "507f1f77bcf86cd799439092";
const paymentId = "507f1f77bcf86cd799439093";

function mockRequest(body = {}, id = paymentId) {
    return {
        body,
        params: { id },
        user: { id: memberId, role: "admin" },
    };
}

function mockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function validPaymentBody() {
    return {
        membershipId,
        amount: 50,
        paymentMethod: "cash",
        transactionId: "TXN-001",
    };
}

function membershipDocument() {
    return {
        _id: membershipId,
        user: memberId,
        membershipType: "basic",
        status: "active",
        endDate: new Date("2099-01-01"),
        save: jest.fn().mockResolvedValue(undefined),
    };
}

function paymentDocument(overrides = {}) {
    return {
        _id: paymentId,
        member: memberId,
        membership: membershipId,
        amount: 50,
        paymentMethod: "cash",
        status: "pending",
        purpose: "payment",
        save: jest.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function mockPopulateChain(result) {
    const secondPopulate = jest.fn().mockResolvedValue(result);
    const firstPopulate = jest.fn().mockReturnValue({
        populate: secondPopulate,
    });

    return {
        populate: firstPopulate,
        firstPopulate,
        secondPopulate,
    };
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Payment controller - createPayment", () => {
    test("Rejects missing required fields", async () => {
        const res = mockResponse();

        await createPayment(mockRequest({}), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership ID, amount, and payment method are required",
        });
    });

    test("Rejects invalid membership ID", async () => {
        const res = mockResponse();

        await createPayment(
            mockRequest({
                ...validPaymentBody(),
                membershipId: "invalid",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid membership ID",
        });
    });

    test("Rejects non-positive payment amount", async () => {
        const res = mockResponse();

        await createPayment(
            mockRequest({
                ...validPaymentBody(),
                amount: -10,
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Amount must be a positive number",
        });
    });

    test("Rejects invalid payment method", async () => {
        const res = mockResponse();

        await createPayment(
            mockRequest({
                ...validPaymentBody(),
                paymentMethod: "crypto",
            }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid payment method",
        });
    });

    test("Returns 404 when membership does not exist", async () => {
        Membership.findById.mockResolvedValue(null);

        const res = mockResponse();
        await createPayment(
            mockRequest(validPaymentBody()),
            res
        );

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership not found",
        });
    });

    test("Successfully creates pending payment", async () => {
        const membership = membershipDocument();
        Membership.findById.mockResolvedValue(membership);

        const payment = paymentDocument();
        Payment.create.mockResolvedValue(payment);

        const res = mockResponse();
        await createPayment(
            mockRequest(validPaymentBody()),
            res
        );

        expect(Payment.create).toHaveBeenCalledWith({
            member: memberId,
            membership: membershipId,
            amount: 50,
            paymentMethod: "cash",
            transactionId: "TXN-001",
            status: "pending",
        });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Payment created successfully",
            payment,
        });
    });
});

describe("Payment controller - getAllPayments", () => {
    test("Returns all payments with count", async () => {
        const payments = [
            paymentDocument(),
            paymentDocument(),
        ];

        const sort = jest.fn().mockResolvedValue(payments);
        const secondPopulate = jest.fn().mockReturnValue({ sort });
        const firstPopulate = jest.fn().mockReturnValue({
            populate: secondPopulate,
        });

        Payment.find.mockReturnValue({
            populate: firstPopulate,
        });

        const res = mockResponse();
        await getAllPayments(mockRequest(), res);

        expect(firstPopulate).toHaveBeenCalledWith(
            "member", "firstName lastName email"
        );
        expect(secondPopulate).toHaveBeenCalledWith(
            "membership", "membershipType status"
        );
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            count: 2,
            payments,
        });
    });

    test("Returns empty payment history", async () => {
        const sort = jest.fn().mockResolvedValue([]);
        const secondPopulate = jest.fn().mockReturnValue({ sort });
        const firstPopulate = jest.fn().mockReturnValue({
            populate: secondPopulate,
        });

        Payment.find.mockReturnValue({
            populate: firstPopulate,
        });

        const res = mockResponse();
        await getAllPayments(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            count: 0,
            payments: [],
        });
    });
});

describe("Payment controller - getPaymentById", () => {
    test("Rejects invalid payment ID", async () => {
        const res = mockResponse();

        await getPaymentById(
            mockRequest({}, "invalid"),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Returns 404 when payment does not exist", async () => {
        Payment.findById.mockReturnValue(
            mockPopulateChain(null)
        );

        const res = mockResponse();
        await getPaymentById(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Payment not found",
        });
    });

    test("Returns payment by ID", async () => {
        const payment = paymentDocument();

        Payment.findById.mockReturnValue(
            mockPopulateChain(payment)
        );

        const res = mockResponse();
        await getPaymentById(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            payment,
        });
    });
});

describe("Payment controller - updatePaymentStatus", () => {
    let session;

    beforeEach(() => {
        session = {
            withTransaction: jest.fn(async callback => {
                await callback();
            }),
            endSession: jest.fn().mockResolvedValue(undefined),
        };

        jest.spyOn(mongoose, "startSession")
            .mockResolvedValue(session);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("Rejects invalid payment ID", async () => {
        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }, "invalid"),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mongoose.startSession).not.toHaveBeenCalled();
    });

    test("Rejects invalid payment status", async () => {
        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "refunded" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(mongoose.startSession).not.toHaveBeenCalled();
    });

    test("Successfully marks pending payment as paid", async () => {
        const payment = paymentDocument({
            status: "paid",
        });

        Payment.findOneAndUpdate.mockResolvedValue(payment);

        const res = mockResponse();
        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: paymentId, status: "pending" },
            {
                $set: {
                    status: "paid",
                    paidAt: expect.any(Date),
                },
            },
            {
                returnDocument: "after",
                session,
            }
        );

        expect(session.withTransaction).toHaveBeenCalledTimes(1);
        expect(session.endSession).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("Successfully marks pending payment as failed", async () => {
        const payment = paymentDocument({
            status: "failed",
        });

        Payment.findOneAndUpdate.mockResolvedValue(payment);

        const res = mockResponse();
        await updatePaymentStatus(
            mockRequest({ status: "failed" }),
            res
        );

        expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
            { _id: paymentId, status: "pending" },
            {
                $set: {
                    status: "failed",
                    paidAt: null,
                },
            },
            {
                returnDocument: "after",
                session,
            }
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    test("Rejects already finalized payment", async () => {
        Payment.findOneAndUpdate.mockResolvedValue(null);

        const res = mockResponse();
        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Payment not found or already finalized",
        });
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    test("Rejects renewal payment with invalid months", async () => {
        Payment.findOneAndUpdate.mockResolvedValue(
            paymentDocument({
                purpose: "renewal",
                renewalMonths: 0,
                status: "paid",
            })
        );

        const res = mockResponse();
        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid renewal months",
        });
    });

    test("Rejects renewal for missing membership", async () => {
        Payment.findOneAndUpdate.mockResolvedValue(
            paymentDocument({
                purpose: "renewal",
                renewalMonths: 3,
                status: "paid",
            })
        );

        Membership.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(null),
        });

        const res = mockResponse();
        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Membership not found",
        });
    });

    test("Rejects renewal for inactive membership", async () => {
        Payment.findOneAndUpdate.mockResolvedValue(
            paymentDocument({
                purpose: "renewal",
                renewalMonths: 3,
                status: "paid",
            })
        );

        Membership.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(
                membershipDocument()
            ),
        });

        const membership = membershipDocument();
        membership.status = "inactive";

        Membership.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(membership),
        });

        const res = mockResponse();
        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Inactive membership cannot be renewed",
        });
    });

    test("Successfully applies paid membership renewal", async () => {
        const plan = membershipPlans.basic;
        const membership = membershipDocument();

        const payment = paymentDocument({
            purpose: "renewal",
            renewalMonths: 3,
            amount: plan.monthlyPrice * 3,
            currency: plan.currency,
            status: "paid",
        });

        Payment.findOneAndUpdate.mockResolvedValue(payment);

        Membership.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(membership),
        });

        const originalEndDate = membership.endDate;

        const res = mockResponse();
        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(membership.endDate.getTime())
            .toBeGreaterThan(originalEndDate.getTime());

        expect(membership.save).toHaveBeenCalledWith({
            session,
        });
        expect(payment.save).toHaveBeenCalledWith({
            session,
        });
        expect(payment.renewalAppliedAt).toBeInstanceOf(Date);
        expect(res.status).toHaveBeenCalledWith(200);
    });
});

describe("Payment controller - getMyPayments", () => {
    test("Returns member's payment history", async () => {
        const payments = [paymentDocument()];

        const sort = jest.fn().mockResolvedValue(payments);
        const populate = jest.fn().mockReturnValue({ sort });

        Payment.find.mockReturnValue({ populate });

        const req = mockRequest();
        req.user.role = "member";

        const res = mockResponse();
        await getMyPayments(req, res);

        expect(Payment.find).toHaveBeenCalledWith({
            member: memberId,
        });
        expect(sort).toHaveBeenCalledWith({
            createdAt: -1,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            count: 1,
            payments,
        });
    });
});

describe("Payment controller - getRevenueSummary", () => {
    test("Returns revenue summary", async () => {
        Payment.aggregate.mockResolvedValue([{
            totalPayments: 10,
            paidPayments: 6,
            pendingPayments: 2,
            failedPayments: 1,
            refundedPayments: 1,
            totalRevenue: 300,
        }]);

        const res = mockResponse();
        await getRevenueSummary(mockRequest(), res);

        expect(Payment.aggregate).toHaveBeenCalledWith(
            expect.any(Array)
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            currency: "USD",
            totalPayments: 10,
            paidPayments: 6,
            pendingPayments: 2,
            failedPayments: 1,
            refundedPayments: 1,
            totalRevenue: 300,
        });
    });

    test("Returns zero revenue when no payments exist", async () => {
        Payment.aggregate.mockResolvedValue([]);

        const res = mockResponse();
        await getRevenueSummary(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            currency: "USD",
            totalPayments: 0,
            paidPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            refundedPayments: 0,
            totalRevenue: 0,
        });
    });
});



describe("Payment controller - security and edge cases", () => {
    let session;

    beforeEach(() => {
        session = {
            withTransaction: jest.fn(async callback => {
                await callback();
            }),
            endSession: jest.fn().mockResolvedValue(undefined),
        };

        jest.spyOn(mongoose, "startSession")
            .mockResolvedValue(session);

        jest.spyOn(console, "error")
            .mockImplementation(() => {});
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function setupRenewal(overrides = {}, membershipOverrides = {}) {
        const plan = membershipPlans.basic;

        const payment = paymentDocument({
            purpose: "renewal",
            renewalMonths: 3,
            amount: plan.monthlyPrice * 3,
            currency: plan.currency,
            status: "paid",
            ...overrides,
        });

        const membership = {
            ...membershipDocument(),
            ...membershipOverrides,
        };

        Payment.findOneAndUpdate.mockResolvedValue(payment);

        Membership.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(membership),
        });

        return { payment, membership };
    }

    test("Rejects renewal when payment owner differs from membership owner", async () => {
        const { payment, membership } = setupRenewal({
            member: "507f1f77bcf86cd799439099",
        });

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Renewal payment member does not match membership owner",
        });
        expect(membership.save).not.toHaveBeenCalled();
        expect(payment.save).not.toHaveBeenCalled();
    });

    test("Rejects renewal with incorrect payment amount", async () => {
        const { payment, membership } = setupRenewal({
            amount: 1,
        });

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Renewal payment amount or currency does not match the membership plan",
        });
        expect(membership.save).not.toHaveBeenCalled();
        expect(payment.save).not.toHaveBeenCalled();
    });

    test("Rejects renewal with incorrect currency", async () => {
        const { membership } = setupRenewal({
            currency: "INVALID",
        });

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(membership.save).not.toHaveBeenCalled();
    });

    test("Rejects renewal with unknown membership plan", async () => {
        const { membership } = setupRenewal(
            {},
            { membershipType: "unknown" }
        );

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid membership plan",
        });
        expect(membership.save).not.toHaveBeenCalled();
    });

    test("Failed renewal payment does not extend membership", async () => {
        const payment = paymentDocument({
            purpose: "renewal",
            renewalMonths: 3,
            status: "failed",
        });

        Payment.findOneAndUpdate.mockResolvedValue(payment);

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "failed" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(Membership.findById).not.toHaveBeenCalled();
        expect(payment.save).not.toHaveBeenCalled();
    });

    test("Rejects already finalized payment without modifying membership", async () => {
        Payment.findOneAndUpdate.mockResolvedValue(null);

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(Membership.findById).not.toHaveBeenCalled();
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    test("Returns server error when payment update fails", async () => {
        Payment.findOneAndUpdate.mockRejectedValue(
            new Error("Database failure")
        );

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    test("Returns server error when membership save fails", async () => {
        const { membership } = setupRenewal();

        membership.save.mockRejectedValue(
            new Error("Membership save failed")
        );

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    test("Returns server error when payment save fails", async () => {
        const { payment } = setupRenewal();

        payment.save.mockRejectedValue(
            new Error("Payment save failed")
        );

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(session.endSession).toHaveBeenCalledTimes(1);
    });

    test("Rejects fractional renewal months", async () => {
        const { membership } = setupRenewal({
            renewalMonths: 2.5,
        });

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid renewal months",
        });
        expect(membership.save).not.toHaveBeenCalled();
    });

    test("Rejects renewal months greater than 12", async () => {
        const { membership } = setupRenewal({
            renewalMonths: 13,
        });

        const res = mockResponse();

        await updatePaymentStatus(
            mockRequest({ status: "paid" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(membership.save).not.toHaveBeenCalled();
    });

    test("Returns server error when payment creation fails", async () => {
        Membership.findById.mockResolvedValue(
            membershipDocument()
        );

        Payment.create.mockRejectedValue(
            new Error("Database failure")
        );

        const res = mockResponse();

        await createPayment(
            mockRequest(validPaymentBody()),
            res
        );

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
    });

    test("Returns server error when payment lookup fails", async () => {
        Payment.findById.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                populate: jest.fn().mockRejectedValue(
                    new Error("Database failure")
                ),
            }),
        });

        const res = mockResponse();

        await getPaymentById(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test("Returns server error when payment history query fails", async () => {
        Payment.find.mockReturnValue({
            populate: jest.fn().mockReturnValue({
                sort: jest.fn().mockRejectedValue(
                    new Error("Database failure")
                ),
            }),
        });

        const res = mockResponse();

        await getMyPayments(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(500);
    });

    test("Returns server error when revenue aggregation fails", async () => {
        Payment.aggregate.mockRejectedValue(
            new Error("Database failure")
        );

        const res = mockResponse();

        await getRevenueSummary(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
            message: "Server error",
        });
    });
});
