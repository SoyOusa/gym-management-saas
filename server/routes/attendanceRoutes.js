const express = require("express");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const {
    markAttendance, 
    getMyAttendance,
    getClassAttendance,
    updateAttendance,
    getAttendanceSummary
} = require("../controllers/attendanceController");

const router = express.Router();

// Admins and trainers can record attendance
router.post(
    "/",
    protect,
    authorizeRoles("admin", "trainer"),
    markAttendance
);

//members can view their own attendance history 
router.get(
    "/me",
    protect,
    authorizeRoles("member"),
    getMyAttendance
);

// Trainers and admins can view attendance for a class
router.get(
    "/class/:classId",
    protect,
    authorizeRoles("admin", "trainer"),
    getClassAttendance
);

// Trainers and admins can update attendance for a class
router.patch(
    "/:id",
    protect,
    authorizeRoles("admin", "trainer"),
    updateAttendance
);

// Admins can view attendance statistics
router.get(
    "/summary",
    protect,
    authorizeRoles("admin"),
    getAttendanceSummary
);



module.exports = router;