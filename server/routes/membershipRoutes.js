const express = require("express");
const {protect}= require("../middleware/authMiddleware");
const {
    createMembership, 
    getMyMemberships, 
    getMembershipById,
    updateMembership,
    deleteMembership,
    cancelMembership} = require("../controllers/membershipController");

const router = express.Router();

router.post("/", protect, createMembership);
router.get("/", protect, getMyMemberships);
router.get("/:id", protect, getMembershipById);
router.patch("/:id", protect, updateMembership);
router.delete("/:id", protect, deleteMembership);
router.patch("/:id/cancel", protect, cancelMembership);
module.exports = router;