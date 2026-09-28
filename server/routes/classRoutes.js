const express = require("express");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const {
    createClass,
    getAllClasses,
    getClassById,
    updateClass,
    deleteClass
} = require("../controllers/classController");

const router = express.Router();

router.post("/",protect,authorizeRoles("admin"),createClass);
router.get("/", protect, getAllClasses);
router.get("/:id", protect, getClassById);
router.patch("/:id", protect, authorizeRoles("admin"), updateClass);
router.delete("/:id",protect,authorizeRoles("admin"),deleteClass);
module.exports = router;