const express = require("express");

const {
    protect, authorizeRoles
} = require("../middleware/authMiddleware");

const {
    enrollInClass, 
    getMyEnrollments, 
    cancelEnrollment,
    getAllEnrollments,
    getEnrollmentSummary,
    getEnrollmentById,
} = require("../controllers/enrollmentController");

const router = express.Router();

router.post("/", protect, authorizeRoles("member"), enrollInClass);
router.get("/", protect, authorizeRoles("member"), getMyEnrollments);

router.get("/all", protect, authorizeRoles("admin"), getAllEnrollments);
router.get("/summary", protect, authorizeRoles("admin"), getEnrollmentSummary);
router.get("/:id", protect, authorizeRoles("member"), getEnrollmentById);
router.delete("/:id", protect, authorizeRoles("member"), cancelEnrollment);

module.exports = router;