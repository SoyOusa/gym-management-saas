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

        // Prevent attendance from being marked before the class starts
        const classStart = new Date(gymClass.date);

        const [hours, minutes] = gymClass.startTime
            .split(":")
            .map(Number);

        classStart.setUTCHours(hours, minutes, 0, 0);

        if (classStart > new Date()) {
            return res.status(400).json({
                message: "Cannot mark attendance before the class starts",
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

// Allow members to view their attendance

const getMyAttendance = async(req, res) => {
    try {
        const attendance = await Attendance.find({
            member: req.user.id,
        })
            .populate("gymClass", "name date startTime endTime")
            .sort({ createdAt: -1});
        
        res.status(200).json({
            count: attendance.length,
            attendance,
        });
    } catch (error) {
        console.error("Error fetching attendance:", error);

        res.status(500).json({
            message:"Server error",
        });
    }
};

const getClassAttendance = async(req, res) => {
    try {
        const {classId } = req.params;

        console.log("Authenticated user ID:", req.user.id);
        console.log("Authenticated user role:", req.user.role);
        
        if (!mongoose.Types.ObjectId.isValid(classId)) {
            return res.status(400).json({
                message:"Invalid Class ID",
            });
        }

        const gymClass = await GymClass.findById(classId);

        if(!gymClass) {
            return res.status(404).json({
                message:"Class not found",
            });
        }
        //Trainers can only view attendance for their classes

        if(
            req.user.role === "trainer" && 
            gymClass.trainer.toString() !== req.user.id.toString()            
        ) {
            return res.status(403).json({
                message:"You can only view attendance for your own classes",
            });
        }
        const attendance = await Attendance.find({
            gymClass: classId,
        })
            .populate("member", "name email")
            .populate("markedBy", "name email")
            .sort({createdAt: -1});
        
        res.status(200).json({
            class: {
                id: gymClass._id,
                name: gymClass.name,
                date: gymClass.date,
            },
            count: attendance.length,
            attendance,
        });
    } catch(error) {
        console.error("Error fetching class attendance:", error);

        return res.status(500).json({
            message:"Server error",
        });
    }
}

const updateAttendance = async(req, res) => {
    try {
        const {id} = req.params;

        console.log("Content-Type:", req.headers["content-type"]);
        console.log("Request body:", req.body);
        const {status} = req.body || {};

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message:"Invalid attendance ID",
            });
        }

        if (!["present", "absent"].includes(status)) {
            return res.status(400).json({
                message:"Status must be present or absent",
            });
        }
        
        const attendance = await Attendance.findById(id);
        
        if(!attendance) {
            return res.status(404).json({
                message:"Attendace records not found",
            });
        }

        const gymClass = await GymClass.findById(attendance.gymClass);

        if(!gymClass) {
            return res.status(404).json({
                message:"Class not found",
            });
        }
        // Prevent attendance updates before the class starts
        const classStart = new Date(gymClass.date);

        const [hours, minutes] = gymClass.startTime
            .split(":")
            .map(Number);

        classStart.setUTCHours(hours, minutes, 0, 0);

        if (classStart > new Date()) {
            return res.status(400).json({
                message: "Cannot update attendance before the class starts",
            });
        }

        //Trainers can only update attendance only for their classes
        if (
            req.user.role === "trainer" &&
            gymClass.trainer.toString() !== req.user.id.toString()
        ) {
            return res.status(403).json({
                message:"You can only update attendance for your own classes",
            });
        }
        attendance.status = status;
        attendance.markedBy = req.user.id;

        await attendance.save();
        
        return res.status(200).json({
            message:"Attendance update successfully",
        });
    }  catch(error) {
        console.error("Error updating attendace:", error);

        return res.status(500).json({
            message:"Server error",
        });
    }
};

const getAttendanceSummary = async (req, res) => {
    try {
        const [total, present, absent] = await Promise.all([
            Attendance.countDocuments(),
            Attendance.countDocuments({ status: "present" }),
            Attendance.countDocuments({ status: "absent" }),
        ]);

        const attendanceRate =
            total > 0
                ? Number(((present / total) * 100).toFixed(2))
                : 0;

        res.status(200).json({
            total,
            present,
            absent,
            attendanceRate,
        });
    } catch (error) {
        console.error("Error fetching attendance summary:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};
module.exports = {
    markAttendance, 
    getMyAttendance,
    getClassAttendance,
    updateAttendance,
    getAttendanceSummary
};