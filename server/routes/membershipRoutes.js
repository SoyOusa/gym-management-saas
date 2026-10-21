const express = require("express");
const {protect, authorizeRoles}= require("../middleware/authMiddleware");
const {
    createMembership, 
    getMyMemberships, 
    getMembershipById,
    updateMembership,
    deleteMembership,
    cancelMembership,
} = require("../controllers/membershipController");

const router = express.Router();

router.post("/", protect, createMembership);

router.get("/", protect, getMyMemberships);
router.get("/:id", protect, getMembershipById);

router.patch("/:id", protect, updateMembership);
router.patch("/:id/cancel", protect, cancelMembership);

router.delete("/:id", protect, deleteMembership);


module.exports = router;