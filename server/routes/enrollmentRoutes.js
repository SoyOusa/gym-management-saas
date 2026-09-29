const express = require("express");

const {
    protect, authorizeRoles
} = require("../middleware/authMiddleware");

const {
    enrollInClass, getMyEnrollments
} = require("../controllers/enrollmentController");

const router = express.Router();

router.post("/", protect, authorizeRoles("member"), enrollInClass);
router.get("/", protect, authorizeRoles("member"), getMyEnrollments);
module.exports = router;