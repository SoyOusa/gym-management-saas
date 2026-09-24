const express = require("express");
const {protect}= require("../middleware/authMiddleware");
const {createMembership, getMyMemberships} = require("../controllers/membershipController");

const router = express.Router();

router.post("/", protect, createMembership);
router.get("/", protect, getMyMemberships)

module.exports = router;