
const mongoose = require("mongoose");

jest.mock("../models/Class", () => ({
    findById: jest.fn(),
}));

jest.mock("../models/Enrollment", () => ({
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock("../models/Membership", () => ({
    findOne: jest.fn(),
}));

const GymClass = require("../models/Class");
const Enrollment = require("../models/Enrollment");
const Membership = require("../models/Membership");

const {
    enrollInClass,
    getMyEnrollments,
    cancelEnrollment,
    getAllEnrollments,
    getEnrollmentSummary,
    getEnrollmentById,
} = require("../controllers/enrollmentController");

const memberId = "507f1f77bcf86cd799439091";
const classId = "507f1f77bcf86cd799439086";
const enrollmentId = "507f1f77bcf86cd799439092";
const trainerId = "507f1f77bcf86cd799439093";

function mockRequest(body = {}, params = {}) {
    return {
        body,
        params,
        user: {
            id: memberId,
            role: "member",
        },
    };
}

function mockResponse() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

function futureClass(capacity = 10) {
    return {
        _id: classId,
        name: "Morning Yoga",
        date: new Date("2099-01-01"),
        startTime: "10:00",
        capacity,
        trainer: new mongoose.Types.ObjectId(trainerId),
    };
}

function pastClass() {
    return {
        ...futureClass(),
        date: new Date("2020-01-01"),
    };
}

function mockValidEnrollment() {
    GymClass.findById.mockResolvedValue(futureClass());
    Enrollment.findOne.mockResolvedValue(null);
    Membership.findOne.mockResolvedValue({
        user: memberId,
        status: "active",
        endDate: new Date("2099-12-31"),
    });
    Enrollment.countDocuments.mockResolvedValue(3);
}

beforeEach(() => {
    jest.clearAllMocks();
});

describe("Enrollment controller - enrollInClass", () => {
    test("Rejects missing class ID", async () => {
        const res = mockResponse();

        await enrollInClass(mockRequest({}), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class ID is required",
        });
        expect(GymClass.findById).not.toHaveBeenCalled();
    });

    test("Returns 404 when class does not exist", async () => {
        GymClass.findById.mockResolvedValue(null);

        const res = mockResponse();
        await enrollInClass(mockRequest({ classId }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class not found",
        });
    });

    test("Rejects enrollment after class has started", async () => {
        GymClass.findById.mockResolvedValue(pastClass());

        const res = mockResponse();
        await enrollInClass(mockRequest({ classId }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Cannot enroll in a class that has already started",
        });
        expect(Enrollment.create).not.toHaveBeenCalled();
    });

    test("Rejects member without active membership", async () => {
        GymClass.findById.mockResolvedValue(futureClass());
        Enrollment.findOne.mockResolvedValue(null);
        Membership.findOne.mockResolvedValue(null);

        const res = mockResponse();
        await enrollInClass(mockRequest({ classId }), res);

        expect(Membership.findOne).toHaveBeenCalledWith({
            user: memberId,
            status: "active",
            endDate: { $gt: expect.any(Date) },
        });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "You need an active membership to enroll in class",
        });
    });

    test("Rejects enrollment when class is full", async () => {
        mockValidEnrollment();
        Enrollment.countDocuments.mockResolvedValue(10);

        const res = mockResponse();
        await enrollInClass(mockRequest({ classId }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class is full",
        });
        expect(Enrollment.create).not.toHaveBeenCalled();
    });

    test("Rejects duplicate enrollment", async () => {
        mockValidEnrollment();

        Enrollment.findOne.mockResolvedValue({
            _id: enrollmentId,
            member: memberId,
            gymClass: classId,
        });

        const res = mockResponse();
        await enrollInClass(mockRequest({ classId }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "You are already enrolled in this class",
        });
        expect(Enrollment.create).not.toHaveBeenCalled();
    });

    test("Successfully enrolls member in available class", async () => {
        mockValidEnrollment();

        const enrollment = {
            _id: enrollmentId,
            member: memberId,
            gymClass: classId,
        };

        Enrollment.create.mockResolvedValue(enrollment);

        const res = mockResponse();
        await enrollInClass(mockRequest({ classId }), res);

        expect(Enrollment.create).toHaveBeenCalledWith({
            member: memberId,
            gymClass: classId,
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Successfully enrolled in class",
            enrollment,
        });
    });

    test("Returns 500 when enrollment database query fails", async () => {
        GymClass.findById.mockRejectedValue(
            new Error("Database unavailable")
        );

        const spy = jest.spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            const res = mockResponse();
            await enrollInClass(mockRequest({ classId }), res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Server error",
            });
        } finally {
            spy.mockRestore();
        }
    });
});

describe("Enrollment controller - getMyEnrollments", () => {
    test("Member can retrieve their enrollments", async () => {
        const records = [
            { _id: enrollmentId, member: memberId },
        ];

        const sort = jest.fn().mockResolvedValue(records);
        const populate = jest.fn().mockReturnValue({ sort });
        Enrollment.find.mockReturnValue({ populate });

        const res = mockResponse();
        await getMyEnrollments(mockRequest(), res);

        expect(Enrollment.find).toHaveBeenCalledWith({
            member: memberId,
        });
        expect(populate).toHaveBeenCalledWith({
            path: "gymClass",
            populate: {
                path: "trainer",
                select: "-password",
            },
        });
        expect(sort).toHaveBeenCalledWith({ createAt: -1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            enrollments: records,
        });
    });

    test("Returns empty array when member has no enrollments", async () => {
        const sort = jest.fn().mockResolvedValue([]);
        const populate = jest.fn().mockReturnValue({ sort });
        Enrollment.find.mockReturnValue({ populate });

        const res = mockResponse();
        await getMyEnrollments(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            enrollments: [],
        });
    });
});

describe("Enrollment controller - cancelEnrollment", () => {
    test("Rejects invalid enrollment ID", async () => {
        const res = mockResponse();

        await cancelEnrollment(
            mockRequest({}, { id: "invalid-id" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid enrollment ID",
        });
    });

    test("Returns 404 when enrollment is not owned by member", async () => {
        Enrollment.findOne.mockResolvedValue(null);

        const res = mockResponse();
        await cancelEnrollment(
            mockRequest({}, { id: enrollmentId }),
            res
        );

        expect(Enrollment.findOne).toHaveBeenCalledWith({
            _id: enrollmentId,
            member: memberId,
        });
        expect(res.status).toHaveBeenCalledWith(404);
        expect(Enrollment.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test("Successfully cancels member enrollment", async () => {
        Enrollment.findOne.mockResolvedValue({
            _id: enrollmentId,
            member: memberId,
        });

        Enrollment.findByIdAndDelete.mockResolvedValue({
            _id: enrollmentId,
        });

        const res = mockResponse();
        await cancelEnrollment(
            mockRequest({}, { id: enrollmentId }),
            res
        );

        expect(Enrollment.findByIdAndDelete)
            .toHaveBeenCalledWith(enrollmentId);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Enrollment cancelled successfully",
        });
    });
});

describe("Enrollment controller - getAllEnrollments", () => {
    test("Admin can retrieve all enrollments", async () => {
        const records = [{ _id: enrollmentId }];

        const sort = jest.fn().mockResolvedValue(records);
        const secondPopulate = jest.fn().mockReturnValue({ sort });
        const firstPopulate = jest.fn().mockReturnValue({
            populate: secondPopulate,
        });

        Enrollment.find.mockReturnValue({
            populate: firstPopulate,
        });

        const req = mockRequest();
        req.user.role = "admin";

        const res = mockResponse();
        await getAllEnrollments(req, res);

        expect(firstPopulate).toHaveBeenCalledWith(
            "member", "-password"
        );
        expect(secondPopulate).toHaveBeenCalledWith({
            path: "gymClass",
            populate: {
                path: "trainer",
                select: "-password",
            },
        });
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            enrollments: records,
        });
    });
});

describe("Enrollment controller - getEnrollmentSummary", () => {
    test("Returns total enrollment count", async () => {
        Enrollment.countDocuments.mockResolvedValue(25);

        const res = mockResponse();
        await getEnrollmentSummary({}, res);

        expect(Enrollment.countDocuments).toHaveBeenCalledWith();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            totalEnrollments: 25,
        });
    });

    test("Returns zero when there are no enrollments", async () => {
        Enrollment.countDocuments.mockResolvedValue(0);

        const res = mockResponse();
        await getEnrollmentSummary({}, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            totalEnrollments: 0,
        });
    });
});

describe("Enrollment controller - getEnrollmentById", () => {
    test("Rejects invalid enrollment ID", async () => {
        const res = mockResponse();

        await getEnrollmentById(
            mockRequest({}, { id: "invalid-id" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid enrollment ID",
        });
    });

    test("Returns 404 when enrollment is not found", async () => {
        const secondPopulate = jest.fn().mockResolvedValue(null);
        const firstPopulate = jest.fn().mockReturnValue({
            populate: secondPopulate,
        });

        Enrollment.findOne.mockReturnValue({
            populate: firstPopulate,
        });

        const res = mockResponse();
        await getEnrollmentById(
            mockRequest({}, { id: enrollmentId }),
            res
        );

        expect(Enrollment.findOne).toHaveBeenCalledWith({
            _id: enrollmentId,
            member: memberId,
        });
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Enrollment not found",
        });
    });

    test("Member can retrieve their enrollment by ID", async () => {
        const enrollment = {
            _id: enrollmentId,
            member: memberId,
            gymClass: classId,
        };

        const secondPopulate = jest.fn()
            .mockResolvedValue(enrollment);

        const firstPopulate = jest.fn().mockReturnValue({
            populate: secondPopulate,
        });

        Enrollment.findOne.mockReturnValue({
            populate: firstPopulate,
        });

        const res = mockResponse();
        await getEnrollmentById(
            mockRequest({}, { id: enrollmentId }),
            res
        );

        expect(firstPopulate).toHaveBeenCalledWith(
            "member", "-password"
        );
        expect(secondPopulate).toHaveBeenCalledWith({
            path: "gymClass",
            populate: {
                path: "trainer",
                select: "-password",
            },
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            enrollment,
        });
    });
});
