
const mongoose = require("mongoose");

jest.mock("../models/Class", () => ({
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn(),
}));

jest.mock("../models/User", () => ({
    findById: jest.fn(),
}));

jest.mock("../models/Enrollment", () => ({
    countDocuments: jest.fn(),
}));

const GymClass = require("../models/Class");
const User = require("../models/User");
const Enrollment = require("../models/Enrollment");

const {
    createClass,
    getAllClasses,
    getClassById,
    updateClass,
    deleteClass,
} = require("../controllers/classController");

const classId = "507f1f77bcf86cd799439086";
const trainerId = "507f1f77bcf86cd799439093";

function mockRequest(body = {}, id = classId) {
    return {
        body,
        params: { id },
        user: { id: trainerId, role: "admin" },
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
        name: "Morning Yoga",
        description: "Beginner yoga class",
        trainer: trainerId,
        date: "2099-01-01",
        startTime: "09:00",
        endTime: "10:00",
        capacity: 15,
    };
}

function classDocument() {
    return {
        _id: classId,
        ...validBody(),
        save: jest.fn().mockResolvedValue(undefined),
    };
}

function mockPopulatedClass(result) {
    GymClass.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(result),
    });
}

beforeEach(() => {
    jest.resetAllMocks();
});

describe("Class controller - createClass", () => {
    test("Rejects missing required fields", async () => {
        const res = mockResponse();

        await createClass(mockRequest({ name: "Yoga" }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Please provide all required class fields",
        });
        expect(GymClass.create).not.toHaveBeenCalled();
    });

    test("Returns 404 when trainer does not exist", async () => {
        User.findById.mockResolvedValue(null);

        const res = mockResponse();
        await createClass(mockRequest(validBody()), res);

        expect(User.findById).toHaveBeenCalledWith(trainerId);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Trainer not found",
        });
    });

    test("Rejects a user who is not a trainer", async () => {
        User.findById.mockResolvedValue({ role: "member" });

        const res = mockResponse();
        await createClass(mockRequest(validBody()), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "selected user is not a trainer",
        });
    });

    test("Rejects capacity below one", async () => {
        User.findById.mockResolvedValue({ role: "trainer" });

        const res = mockResponse();
        await createClass(
            mockRequest({ ...validBody(), capacity: 0 }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Capacity must be at least 1",
        });
    });

    test("Creates and returns a populated class", async () => {
        User.findById.mockResolvedValue({ role: "trainer" });
        GymClass.create.mockResolvedValue({ _id: classId });

        const populatedClass = {
            _id: classId,
            ...validBody(),
            trainer: { _id: trainerId, name: "Trainer" },
        };

        mockPopulatedClass(populatedClass);

        const res = mockResponse();
        await createClass(mockRequest(validBody()), res);

        expect(GymClass.create).toHaveBeenCalledWith(validBody());
        expect(GymClass.findById).toHaveBeenCalledWith(classId);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class created successfully",
            class: populatedClass,
        });
    });

    test("Returns 500 when class creation fails", async () => {
        User.findById.mockResolvedValue({ role: "trainer" });
        GymClass.create.mockRejectedValue(new Error("Database error"));

        const spy = jest.spyOn(console, "error")
            .mockImplementation(() => {});

        try {
            const res = mockResponse();
            await createClass(mockRequest(validBody()), res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                message: "Server error",
            });
        } finally {
            spy.mockRestore();
        }
    });
});

describe("Class controller - getAllClasses", () => {
    test("Returns classes sorted by date and start time", async () => {
        const classes = [classDocument()];

        const sort = jest.fn().mockResolvedValue(classes);
        const populate = jest.fn().mockReturnValue({ sort });
        GymClass.find.mockReturnValue({ populate });

        const res = mockResponse();
        await getAllClasses(mockRequest(), res);

        expect(populate).toHaveBeenCalledWith(
            "trainer", "-password"
        );
        expect(sort).toHaveBeenCalledWith({
            date: 1,
            startTime: 1,
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ classes });
    });

    test("Returns empty array when no classes exist", async () => {
        const sort = jest.fn().mockResolvedValue([]);
        const populate = jest.fn().mockReturnValue({ sort });
        GymClass.find.mockReturnValue({ populate });

        const res = mockResponse();
        await getAllClasses(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            classes: [],
        });
    });
});

describe("Class controller - getClassById", () => {
    test("Rejects invalid class ID", async () => {
        const res = mockResponse();

        await getClassById(mockRequest({}, "invalid-id"), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid class ID",
        });
    });

    test("Returns 404 when class does not exist", async () => {
        mockPopulatedClass(null);

        const res = mockResponse();
        await getClassById(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class not found",
        });
    });

    test("Returns class with populated trainer", async () => {
        const gymClass = classDocument();
        mockPopulatedClass(gymClass);

        const res = mockResponse();
        await getClassById(mockRequest(), res);

        expect(GymClass.findById).toHaveBeenCalledWith(classId);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            class: gymClass,
        });
    });
});

describe("Class controller - updateClass", () => {
    test("Rejects invalid class ID", async () => {
        const res = mockResponse();

        await updateClass(
            mockRequest({ name: "Updated" }, "invalid-id"),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
    });

    test("Rejects update when class does not exist", async () => {
        GymClass.findById.mockResolvedValue(null);

        const res = mockResponse();
        await updateClass(mockRequest({ name: "Updated" }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class not found",
        });
    });

    test("Rejects nonexistent replacement trainer", async () => {
        GymClass.findById.mockResolvedValue(classDocument());
        User.findById.mockResolvedValue(null);

        const res = mockResponse();
        await updateClass(mockRequest({ trainer: trainerId }), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Trainer not found",
        });
    });

    test("Rejects replacement user who is not a trainer", async () => {
        GymClass.findById.mockResolvedValue(classDocument());
        User.findById.mockResolvedValue({ role: "member" });

        const res = mockResponse();
        await updateClass(mockRequest({ trainer: trainerId }), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Selected user is not a trainer",
        });
    });

    test("Rejects invalid date", async () => {
        GymClass.findById.mockResolvedValue(classDocument());

        const res = mockResponse();
        await updateClass(
            mockRequest({ date: "not-a-date" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Date must be a valid date",
        });
    });

    test("Rejects end time before start time", async () => {
        GymClass.findById.mockResolvedValue(classDocument());

        const res = mockResponse();
        await updateClass(
            mockRequest({ endTime: "08:00" }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "End time must be after start time",
        });
    });

    test("Rejects capacity that is not a positive integer", async () => {
        GymClass.findById.mockResolvedValue(classDocument());

        const res = mockResponse();
        await updateClass(
            mockRequest({ capacity: 2.5 }),
            res
        );

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Capacity must be a positive integer",
        });
    });

    test("Rejects capacity below existing enrollment count", async () => {
        GymClass.findById.mockResolvedValue(classDocument());
        Enrollment.countDocuments.mockResolvedValue(8);

        const res = mockResponse();
        await updateClass(
            mockRequest({ capacity: 5 }),
            res
        );

        expect(Enrollment.countDocuments).toHaveBeenCalledWith({
            gymClass: classId,
        });
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Cannot reduce capacity below 8 enrolled members",
        });
    });

    test("Successfully updates class fields and capacity", async () => {
        const gymClass = classDocument();

        GymClass.findById
            .mockResolvedValueOnce(gymClass)
            .mockReturnValueOnce({
                populate: jest.fn().mockResolvedValue({
                    ...gymClass,
                    name: "Advanced Yoga",
                    capacity: 20,
                }),
            });

        Enrollment.countDocuments.mockResolvedValue(5);

        const res = mockResponse();
        await updateClass(
            mockRequest({
                name: "Advanced Yoga",
                capacity: 20,
            }),
            res
        );

        expect(gymClass.name).toBe("Advanced Yoga");
        expect(gymClass.capacity).toBe(20);
        expect(gymClass.save).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Class updated successfully",
            })
        );
    });
});

describe("Class controller - deleteClass", () => {
    test("Rejects invalid class ID", async () => {
        const res = mockResponse();

        await deleteClass(mockRequest({}, "invalid-id"), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Invalid class ID",
        });
    });

    test("Returns 404 when class does not exist", async () => {
        GymClass.findById.mockResolvedValue(null);

        const res = mockResponse();
        await deleteClass(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class not found",
        });
    });

    test("Prevents deleting a class with enrollments", async () => {
        GymClass.findById.mockResolvedValue(classDocument());
        Enrollment.countDocuments.mockResolvedValue(3);

        const res = mockResponse();
        await deleteClass(mockRequest(), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            message: "Cannot delete a class with existing enrollments",
        });
        expect(GymClass.findByIdAndDelete).not.toHaveBeenCalled();
    });

    test("Successfully deletes a class without enrollments", async () => {
        GymClass.findById.mockResolvedValue(classDocument());
        Enrollment.countDocuments.mockResolvedValue(0);
        GymClass.findByIdAndDelete.mockResolvedValue({
            _id: classId,
        });

        const res = mockResponse();
        await deleteClass(mockRequest(), res);

        expect(GymClass.findByIdAndDelete)
            .toHaveBeenCalledWith(classId);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            message: "Class deleted successfully",
        });
    });
});
