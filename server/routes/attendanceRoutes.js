const express = require("express");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const {
    markAttendance,
} = require("../controllers/attendanceController");

const router = express.Router();

// Admins and trainers can record attendance
router.post(
    "/",
    protect,
    authorizeRoles("admin", "trainer"),
    markAttendance
);

module.exports = router;