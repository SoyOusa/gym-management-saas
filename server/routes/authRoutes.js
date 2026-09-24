const express = require("express");

const {registerUser, loginUser, getProfile} = require("../controllers/authController");
const {protect, authorizeRoles} = require("../middleware/authMiddleware");
const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/profile", protect, getProfile);
router.get("/admin-test", protect, authorizeRoles("admin"), (req, res) => {
    res.status(200).json({
        message: "Welcome, admin!",
    });
});

module.exports = router;