const os = require("os");
jest.setTimeout(30000);

const mongoose = require("mongoose");

const User = require("../models/User");
const Membership = require("../models/Membership");
const Payment = require("../models/Payment");

const {
    updatePaymentStatus,
} = require("../controllers/paymentController");

const TEST_DB_URI =
    "mongodb://127.0.0.1:27017/gym_management_test?replicaSet=rs0";

let testUser;
let testMembership;
let testPayment;

function mockResponse() {
    const res = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);

    return res;
}

describe("Payment transaction integration tests", () => {
    beforeAll(async () => {
        console.log("1. Connecting to MongoDB...");

        await mongoose.connect(TEST_DB_URI, {
            serverSelectionTimeoutMS: 5000,
            runtimeAdapters: {
                os: os,
            }
        });

        console.log("2. MongoDB connected.");

        console.log("3. Initializing User model...");
        await User.init();

        console.log("4. Initializing Membership model...");
        await Membership.init();

        console.log("5. Initializing Payment model...");
        await Payment.init();

        console.log("6. All models initialized.");
    });

    afterAll(async () => {
        try {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.dropDatabase();
            }
        } finally {
            if (mongoose.connection.readyState !== 0) {
                await mongoose.disconnect();
            }
        }
    });

    beforeEach(async () => {
        await Promise.all([
            Payment.deleteMany({}),
            Membership.deleteMany({}),
            User.deleteMany({}),
        ]);

        testUser = await User.create({
            firstName: "Integration",
            lastName: "Tester",
            email: "integration-test@example.com",
            password: "testpassword123",
            role: "member",
        });

        testMembership = await Membership.create({
            user: testUser._id,
            membershipType: "basic",
            startDate: new Date("2026-01-01"),
            endDate: new Date("2027-01-01"),
            status: "inactive",
        });

        testPayment = await Payment.create({
            member: testUser._id,
            membership: testMembership._id,
            purpose: "renewal",
            renewalMonths: 3,
            amount: 90,
            currency: "USD",
            paymentMethod: "cash",
            status: "pending",
        });
    });

    test("Rolls back payment approval when membership is inactive", async () => {
        const originalEndDate = testMembership.endDate;

        const req = {
            params: {
                id: testPayment._id.toString(),
            },
            body: {
                status: "paid",
            },
        };

        const res = mockResponse();

        await updatePaymentStatus(req, res);

        // Controller should reject the approval.
        expect(res.status).toHaveBeenCalledWith(400);

        expect(res.json).toHaveBeenCalledWith({
            message: "Inactive membership cannot be renewed",
        });

        // Read fresh documents directly from MongoDB.
        const savedPayment = await Payment.findById(testPayment._id);
        const savedMembership = await Membership.findById(
            testMembership._id
        );

        // The transaction must have rolled back.
        expect(savedPayment.status).toBe("pending");
        expect(savedPayment.paidAt).toBeNull();
        expect(savedPayment.renewalAppliedAt).toBeNull();

        expect(savedMembership.status).toBe("inactive");
        expect(savedMembership.endDate.getTime()).toBe(
            originalEndDate.getTime()
        );
    });

    test("Commits renewal payment and extends active membership", async () => {
        // Create an active membership with a future end date.
        testMembership.status = "active";
        testMembership.endDate = new Date("2027-01-15T00:00:00.000Z");
        await testMembership.save();

        const originalEndDate = testMembership.endDate;

        const req = {
            params: {
                id: testPayment._id.toString(),
            },
            body: {
                status: "paid",
            },
        };

        const res = mockResponse();

        await updatePaymentStatus(req, res);

        // Verify successful payment approval.
        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Payment status updated successfully",
            })
        );

        // Read fresh documents from MongoDB.
        const savedPayment = await Payment.findById(testPayment._id);
        const savedMembership = await Membership.findById(
            testMembership._id
        );

        // Verify payment was committed.
        expect(savedPayment.status).toBe("paid");
        expect(savedPayment.paidAt).toBeInstanceOf(Date);
        expect(savedPayment.renewalAppliedAt).toBeInstanceOf(Date);

        // Verify membership was renewed.
        expect(savedMembership.status).toBe("active");
        expect(savedMembership.endDate.toISOString()).toBe(
            "2027-04-15T00:00:00.000Z"
        );

        expect(savedMembership.endDate.getTime()).toBeGreaterThan(
            originalEndDate.getTime()
        );
    });

});
