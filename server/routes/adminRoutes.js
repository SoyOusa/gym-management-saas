const express = require("express");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const {
    getDashboardStats,
} = require("../controllers/adminController");

const router = express.Router();

router.get(
    "/dashboard",
    protect,
    authorizeRoles("admin"),
    getDashboardStats
);

module.exports = router;