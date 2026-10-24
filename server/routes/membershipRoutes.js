const express = require("express");
const {protect, authorizeRoles}= require("../middleware/authMiddleware");
const {
    createMembership, 
    getMyMemberships, 
    getMembershipById,
    updateMembership,
    deleteMembership,
    cancelMembership,
    renewMembership
} = require("../controllers/membershipController");

const router = express.Router();

router.post("/", protect, createMembership);

router.get("/", protect, getMyMemberships);
router.get("/:id", protect, getMembershipById);

router.patch("/:id", protect, updateMembership);
router.patch("/:id/cancel", protect, cancelMembership);
// Renew a membership
// Temporarily disabled until payment verification is implemented
router.patch("/:id/renew", protect, authorizeRoles("member"), renewMembership);

router.delete("/:id", protect, deleteMembership);


module.exports = router;