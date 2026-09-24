const express = require("express");
const {protect}= require("../middleware/authMiddleware");
const {
    createMembership, 
    getMyMemberships, 
    getMembershipById,
    updateMembership} = require("../controllers/membershipController");

const router = express.Router();

router.post("/", protect, createMembership);
router.get("/", protect, getMyMemberships);
router.get("/:id", protect, getMembershipById);
router.patch("/:id", protect, updateMembership);

module.exports = router;