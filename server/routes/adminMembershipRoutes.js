const express = require("express");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

const {
    getAllMemberships, 
    getMembershipById, 
    updateMembership,
    deleteMembership,
    cancelMembership
} = require("../controllers/adminMembershipController");


const router = express.Router();

router.get("/memberships",protect,authorizeRoles("admin"),getAllMemberships);
router.get("/memberships/:id", protect, authorizeRoles("admin"), getMembershipById);
router.patch("/memberships/:id", protect, authorizeRoles("admin"), updateMembership);
router.delete("/memberships/:id", protect, authorizeRoles("admin"), deleteMembership);
router.patch("/memberships/:id/cancel", protect, authorizeRoles("admin"), cancelMembership);


module.exports = router;