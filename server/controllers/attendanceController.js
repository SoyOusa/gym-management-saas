const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const Enrollment = require("../models/Enrollment");
const GymClass = require("../models/Class");

const markAttendance = async (req, res) => {
    try {
        const { memberId, classId, status } = req.body;

        if (!memberId || !classId || !status) {
            return res.status(400).json({
                message: "Member ID, class ID, and status are required",
            });
        }

        if (
            !mongoose.Types.ObjectId.isValid(memberId) ||
            !mongoose.Types.ObjectId.isValid(classId)
        ) {
            return res.status(400).json({
                message: "Invalid member or class ID",
            });
        }

        if (!["present", "absent"].includes(status)) {
            return res.status(400).json({
                message: "Status must be present or absent",
            });
        }

        const gymClass = await GymClass.findById(classId);

        if (!gymClass) {
            return res.status(404).json({
                message: "Class not found",
            });
        }

        // Trainers can only mark attendance for their assigned classes
        if (
            req.user.role === "trainer" &&
            gymClass.trainer.toString() !== req.user.id.toString()
        ) {
            return res.status(403).json({
                message: "You can only mark attendance for your own classes",
            });
        }

        // The member must be enrolled in this class
        const enrollment = await Enrollment.findOne({
            member: memberId,
            gymClass: classId,
        });

        if (!enrollment) {
            return res.status(400).json({
                message: "Member is not enrolled in this class",
            });
        }

        const existingAttendance = await Attendance.findOne({
            member: memberId,
            gymClass: classId,
        });

        if (existingAttendance) {
            return res.status(400).json({
                message: "Attendance already recorded for this member",
            });
        }

        const attendance = await Attendance.create({
            member: memberId,
            gymClass: classId,
            status,
            markedBy: req.user.id,
        });

        res.status(201).json({
            message: "Attendance recorded successfully",
            attendance,
        });
    } catch (error) {
        console.error("Error marking attendance:", error);

        if (error.code === 11000) {
            return res.status(400).json({
                message: "Attendance already recorded for this member",
            });
        }

        res.status(500).json({
            message: "Server error",
        });
    }
};

module.exports = {
    markAttendance,
};