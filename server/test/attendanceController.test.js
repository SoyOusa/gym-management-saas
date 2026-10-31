
const mongoose = require("mongoose");

// Mock database models before importing the controller.
jest.mock("../models/Attendance", () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    countDocuments: jest.fn(),
}));

jest.mock("../models/Enrollment", () => ({
    findOne: jest.fn(),
}));

jest.mock("../models/Class", () => ({
    findById: jest.fn(),
}));

const Attendance = require("../models/Attendance");
const Enrollment = require("../models/Enrollment");
const GymClass = require("../models/Class");

const {
    markAttendance,
    getMyAttendance,
    getClassAttendance,
    updateAttendance,
    getAttendanceSummary,
} = require("../controllers/attendanceController");

const memberId = "507f1f77bcf86cd799439091";
const classId = "507f1f77bcf86cd799439086";
const trainerId = "507f1f77bcf86cd799439093";

function mockRequest(body = {}, role = "admin") {
    return {
        body,
        user: {
            id: trainerId,
            role,
        },
    };
}

function mockResponse() {
    const res = {};

    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);

    return res;
}

describe("Attendance controller - markAttendance validation", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Rejects missing required fields", async () => {
        const req = mockRequest({});
        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Member ID, class ID, and status are required",
        });
    });

    test("Rejects missing member ID", async () => {
        const req = mockRequest({
            classId,
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Member ID, class ID, and status are required",
        });
    });

    test("Rejects invalid member ID", async () => {
        const req = mockRequest({
            memberId: "invalid-id",
            classId,
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid member or class ID",
        });
    });

    test("Rejects invalid class ID", async () => {
        const req = mockRequest({
            memberId,
            classId: "invalid-id",
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid member or class ID",
        });
    });

    test("Rejects unsupported attendance status", async () => {
        const req = mockRequest({
            memberId,
            classId,
            status: "late",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Status must be present or absent",
        });
    });

    test("Rejects a class that does not exist", async () => {
        GymClass.findById.mockResolvedValue(null);

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(GymClass.findById).toHaveBeenCalledWith(classId);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class not found",
        });
    });

    test("Rejects attendance before class starts", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2099-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(trainerId),
        });

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Cannot mark attendance before the class starts",
        });
    });

    test("Rejects trainers marking attendance for another trainer's class", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2020-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(
                "507f1f77bcf86cd799439099"
            ),
        });

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        }, "trainer");

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            message: "You can only mark attendance for your own classes",
        });
    });

    test("Rejects attendance when member is not enrolled", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2020-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(trainerId),
        });

        Enrollment.findOne.mockResolvedValue(null);

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(Enrollment.findOne).toHaveBeenCalledWith({
            member: memberId,
            gymClass: classId,
        });

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Member is not enrolled in this class",
        });
    });

    test("Rejects duplicate attendance", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2020-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(trainerId),
        });

        Enrollment.findOne.mockResolvedValue({
            _id: "507f1f77bcf86cd799439098",
            member: memberId,
            gymClass: classId,
        });

        Attendance.findOne.mockResolvedValue({
            _id: "507f1f77bcf86cd799439097",
            member: memberId,
            gymClass: classId,
            status: "present",
        });

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Attendance already recorded for this member",
        });

        expect(Attendance.create).not.toHaveBeenCalled();
    });

    test("Admin can successfully record attendance", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2020-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(trainerId),
        });

        Enrollment.findOne.mockResolvedValue({
            member: memberId,
            gymClass: classId,
        });

        Attendance.findOne.mockResolvedValue(null);

        const createdAttendance = {
            _id: "507f1f77bcf86cd799439097",
            member: memberId,
            gymClass: classId,
            status: "present",
            markedBy: trainerId,
        };

        Attendance.create.mockResolvedValue(createdAttendance);

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(Attendance.create).toHaveBeenCalledWith({
            member: memberId,
            gymClass: classId,
            status: "present",
            markedBy: trainerId,
        });

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Attendance recorded successfully",
            attendance: createdAttendance,
        });
    });

    test("Assigned trainer can successfully record attendance", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2020-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(trainerId),
        });

        Enrollment.findOne.mockResolvedValue({
            member: memberId,
            gymClass: classId,
        });

        Attendance.findOne.mockResolvedValue(null);

        const createdAttendance = {
            _id: "507f1f77bcf86cd799439097",
            member: memberId,
            gymClass: classId,
            status: "present",
            markedBy: trainerId,
        };

        Attendance.create.mockResolvedValue(createdAttendance);

        const req = mockRequest(
            {
                memberId,
                classId,
                status: "present",
            },
            "trainer"
        );

        const res = mockResponse();

        await markAttendance(req, res);

        expect(Attendance.create).toHaveBeenCalledWith({
            member: memberId,
            gymClass: classId,
            status: "present",
            markedBy: trainerId,
        });

        expect(res.status).toHaveBeenCalledWith(201);

        expect(res.json).toHaveBeenCalledWith({
            message: "Attendance recorded successfully",
            attendance: createdAttendance,
        });
    });

    test("Handles duplicate attendance database error", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2020-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(trainerId),
        });

        Enrollment.findOne.mockResolvedValue({
            member: memberId,
            gymClass: classId,
        });

        Attendance.findOne.mockResolvedValue(null);

        const duplicateError = new Error("Duplicate key");
        duplicateError.code = 11000;

        Attendance.create.mockRejectedValue(duplicateError);

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        });

        const res = mockResponse();

        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            await markAttendance(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                message: "Attendance already recorded for this member",
            });
        } finally {
            consoleSpy.mockRestore();
        }
    });

    test("Returns 500 when class lookup fails", async () => {
        GymClass.findById.mockRejectedValue(
            new Error("Database connection failed")
        );

        const req = mockRequest({
            memberId,
            classId,
            status: "present",
        });

        const res = mockResponse();

        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            await markAttendance(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Server error",
            });
        } finally {
            consoleSpy.mockRestore();
        }
    });

    test("Does not create attendance when member is not enrolled", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            date: new Date("2020-01-01"),
            startTime: "10:00",
            trainer: new mongoose.Types.ObjectId(trainerId),
        });

        Enrollment.findOne.mockResolvedValue(null);

        const req = mockRequest({
            memberId,
            classId,
            status: "absent",
        });

        const res = mockResponse();

        await markAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(Attendance.create).not.toHaveBeenCalled();
    });
});


describe("Attendance controller - retrieval", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Member can view their own attendance", async () => {
        const records = [
            { _id: "attendance1", member: memberId, status: "present" },
            { _id: "attendance2", member: memberId, status: "absent" },
        ];

        const sort = jest.fn().mockResolvedValue(records);
        const populate = jest.fn().mockReturnValue({ sort });

        Attendance.find.mockReturnValue({ populate });

        const req = {
            user: { id: memberId, role: "member" },
        };
        const res = mockResponse();

        await getMyAttendance(req, res);

        expect(Attendance.find).toHaveBeenCalledWith({
            member: memberId,
        });
        expect(populate).toHaveBeenCalledWith(
            "gymClass",
            "name date startTime endTime"
        );
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            count: 2,
            attendance: records,
        });
    });

    test("Member receives empty attendance history", async () => {
        const sort = jest.fn().mockResolvedValue([]);
        const populate = jest.fn().mockReturnValue({ sort });

        Attendance.find.mockReturnValue({ populate });

        const req = {
            user: { id: memberId, role: "member" },
        };
        const res = mockResponse();

        await getMyAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            count: 0,
            attendance: [],
        });
    });

    test("Returns 500 when member attendance lookup fails", async () => {
        const sort = jest.fn().mockRejectedValue(
            new Error("Database error")
        );
        const populate = jest.fn().mockReturnValue({ sort });

        Attendance.find.mockReturnValue({ populate });

        const req = {
            user: { id: memberId, role: "member" },
        };
        const res = mockResponse();

        const consoleSpy = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            await getMyAttendance(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Server error",
            });
        } finally {
            consoleSpy.mockRestore();
        }
    });

    test("Rejects invalid class ID", async () => {
        const req = {
            params: { classId: "invalid-id" },
            user: { id: trainerId, role: "trainer" },
        };
        const res = mockResponse();

        await getClassAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid Class ID",
        });
    });

    test("Returns 404 when class does not exist", async () => {
        GymClass.findById.mockResolvedValue(null);

        const req = {
            params: { classId },
            user: { id: trainerId, role: "trainer" },
        };
        const res = mockResponse();

        await getClassAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class not found",
        });
    });

    test("Trainer cannot view attendance for another trainer's class", async () => {
        GymClass.findById.mockResolvedValue({
            _id: classId,
            trainer: new mongoose.Types.ObjectId(
                "507f1f77bcf86cd799439099"
            ),
        });

        const req = {
            params: { classId },
            user: { id: trainerId, role: "trainer" },
        };
        const res = mockResponse();

        await getClassAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            message: "You can only view attendance for your own classes",
        });
        expect(Attendance.find).not.toHaveBeenCalled();
    });

    test("Assigned trainer can view class attendance", async () => {
        const gymClass = {
            _id: classId,
            name: "Morning Yoga",
            date: new Date("2020-01-01"),
            trainer: new mongoose.Types.ObjectId(trainerId),
        };

        GymClass.findById.mockResolvedValue(gymClass);

        const records = [
            { _id: "attendance1", status: "present" },
        ];

        const sort = jest.fn().mockResolvedValue(records);
        const secondPopulate = jest.fn().mockReturnValue({ sort });
        const firstPopulate = jest.fn().mockReturnValue({
            populate: secondPopulate,
        });

        Attendance.find.mockReturnValue({
            populate: firstPopulate,
        });

        const req = {
            params: { classId },
            user: { id: trainerId, role: "trainer" },
        };
        const res = mockResponse();

        await getClassAttendance(req, res);

        expect(Attendance.find).toHaveBeenCalledWith({
            gymClass: classId,
        });
        expect(firstPopulate).toHaveBeenCalledWith(
            "member",
            "name email"
        );
        expect(secondPopulate).toHaveBeenCalledWith(
            "markedBy",
            "name email"
        );
        expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            class: {
                id: classId,
                name: "Morning Yoga",
                date: gymClass.date,
            },
            count: 1,
            attendance: records,
        });
    });

    test("Admin can view attendance for any class", async () => {
        const gymClass = {
            _id: classId,
            name: "Evening Fitness",
            date: new Date("2020-01-01"),
            trainer: new mongoose.Types.ObjectId(
                "507f1f77bcf86cd799439099"
            ),
        };

        GymClass.findById.mockResolvedValue(gymClass);

        const sort = jest.fn().mockResolvedValue([]);
        const secondPopulate = jest.fn().mockReturnValue({ sort });
        const firstPopulate = jest.fn().mockReturnValue({
            populate: secondPopulate,
        });

        Attendance.find.mockReturnValue({
            populate: firstPopulate,
        });

        const req = {
            params: { classId },
            user: { id: trainerId, role: "admin" },
        };
        const res = mockResponse();

        await getClassAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            class: {
                id: classId,
                name: "Evening Fitness",
                date: gymClass.date,
            },
            count: 0,
            attendance: [],
        });
    });
});


describe("Attendance controller - updateAttendance", () => {
    const attendanceId = "507f1f77bcf86cd799439092";

    const makeReq = (status = "present", role = "admin") => ({
        params: { id: attendanceId },
        body: { status },
        headers: { "content-type": "application/json" },
        user: { id: trainerId, role },
    });

    const pastClass = () => ({
        _id: classId,
        date: new Date("2020-01-01"),
        startTime: "10:00",
        trainer: new mongoose.Types.ObjectId(trainerId),
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Rejects invalid attendance ID", async () => {
        const req = makeReq();
        req.params.id = "invalid-id";
        const res = mockResponse();

        await updateAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid attendance ID",
        });
        expect(Attendance.findById).not.toHaveBeenCalled();
    });

    test("Rejects invalid attendance status", async () => {
        const req = makeReq("late");
        const res = mockResponse();

        await updateAttendance(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Status must be present or absent",
        });
    });

    test("Returns 404 when attendance record does not exist", async () => {
        Attendance.findById.mockResolvedValue(null);

        const res = mockResponse();
        await updateAttendance(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Attendace records not found",
        });
    });

    test("Returns 404 when related class does not exist", async () => {
        Attendance.findById.mockResolvedValue({
            gymClass: classId,
        });
        GymClass.findById.mockResolvedValue(null);

        const res = mockResponse();
        await updateAttendance(makeReq(), res);

        expect(GymClass.findById).toHaveBeenCalledWith(classId);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class not found",
        });
    });

    test("Rejects attendance updates before class starts", async () => {
        const save = jest.fn();

        Attendance.findById.mockResolvedValue({
            gymClass: classId,
            status: "absent",
            save,
        });

        GymClass.findById.mockResolvedValue({
            ...pastClass(),
            date: new Date("2099-01-01"),
        });

        const res = mockResponse();
        await updateAttendance(makeReq(), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Cannot update attendance before the class starts",
        });
        expect(save).not.toHaveBeenCalled();
    });

    test("Trainer cannot update another trainer's class attendance", async () => {
        const save = jest.fn();

        Attendance.findById.mockResolvedValue({
            gymClass: classId,
            status: "absent",
            save,
        });

        GymClass.findById.mockResolvedValue({
            ...pastClass(),
            trainer: new mongoose.Types.ObjectId(
                "507f1f77bcf86cd799439099"
            ),
        });

        const res = mockResponse();
        await updateAttendance(makeReq("present", "trainer"), res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({
            message: "You can only update attendance for your own classes",
        });
        expect(save).not.toHaveBeenCalled();
    });

    test("Assigned trainer can update attendance", async () => {
        const attendance = {
            gymClass: classId,
            status: "absent",
            markedBy: null,
            save: jest.fn().mockResolvedValue(undefined),
        };

        Attendance.findById.mockResolvedValue(attendance);
        GymClass.findById.mockResolvedValue(pastClass());

        const res = mockResponse();
        await updateAttendance(makeReq("present", "trainer"), res);

        expect(attendance.status).toBe("present");
        expect(attendance.markedBy).toBe(trainerId);
        expect(attendance.save).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Attendance update successfully",
        });
    });

    test("Admin can update attendance for any trainer's class", async () => {
        const attendance = {
            gymClass: classId,
            status: "present",
            save: jest.fn().mockResolvedValue(undefined),
        };

        Attendance.findById.mockResolvedValue(attendance);

        GymClass.findById.mockResolvedValue({
            ...pastClass(),
            trainer: new mongoose.Types.ObjectId(
                "507f1f77bcf86cd799439099"
            ),
        });

        const res = mockResponse();
        await updateAttendance(makeReq("absent", "admin"), res);

        expect(attendance.status).toBe("absent");
        expect(attendance.save).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test("Returns 500 when saving attendance fails", async () => {
        Attendance.findById.mockResolvedValue({
            gymClass: classId,
            status: "absent",
            save: jest.fn().mockRejectedValue(
                new Error("Database save failed")
            ),
        });

        GymClass.findById.mockResolvedValue(pastClass());

        const spy = jest.spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            const res = mockResponse();
            await updateAttendance(makeReq(), res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Server error",
            });
        } finally {
            spy.mockRestore();
        }
    });
});

describe("Attendance controller - summary", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Calculates attendance totals and percentage", async () => {
        Attendance.countDocuments
            .mockResolvedValueOnce(20)
            .mockResolvedValueOnce(15)
            .mockResolvedValueOnce(5);

        const res = mockResponse();

        await getAttendanceSummary({}, res);

        expect(Attendance.countDocuments).toHaveBeenNthCalledWith(1);
        expect(Attendance.countDocuments).toHaveBeenNthCalledWith(
            2, { status: "present" }
        );
        expect(Attendance.countDocuments).toHaveBeenNthCalledWith(
            3, { status: "absent" }
        );

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            total: 20,
            present: 15,
            absent: 5,
            attendanceRate: 75,
        });
    });

    test("Returns zero attendance rate when no records exist", async () => {
        Attendance.countDocuments.mockResolvedValue(0);

        const res = mockResponse();
        await getAttendanceSummary({}, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            total: 0,
            present: 0,
            absent: 0,
            attendanceRate: 0,
        });
    });

    test("Returns 500 when attendance summary query fails", async () => {
        Attendance.countDocuments.mockRejectedValue(
            new Error("Database error")
        );

        const spy = jest.spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            const res = mockResponse();
            await getAttendanceSummary({}, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Server error",
            });
        } finally {
            spy.mockRestore();
        }
    });
});
