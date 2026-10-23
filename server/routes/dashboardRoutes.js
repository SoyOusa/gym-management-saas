const express = require("express");
const router = express.Router();

const {
    getDashboardOverview
} = require("../controllers/dashboardController");

const {
    protect,
    authorizeRoles
} = require("../middleware/authMiddleware");

// Admin: Dashboard overview
router.get(
    "/overview",
    protect,
    authorizeRoles("admin"),
    getDashboardOverview
);

module.exports = router;