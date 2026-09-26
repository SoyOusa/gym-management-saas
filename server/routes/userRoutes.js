const express = require("express");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const {
    getAllUsers,
    getUserById,
    updateUser,
} = require("../controllers/userController");

const router = express.Router();

router.get(
    "/",
    protect,
    authorizeRoles("admin"),
    getAllUsers
);

router.get(
    "/:id",
    protect,
    authorizeRoles("admin"),
    getUserById
);

router.patch(
    "/:id",
    protect,
    authorizeRoles("admin"),
    updateUser
);

module.exports = router;