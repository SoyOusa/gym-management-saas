const express = require("express");
const router = express.Router();

const {
    createPayment,
    getAllPayments,
    getPaymentById,
    updatePaymentStatus,
    getMyPayments,
    getRevenueSummary
} = require("../controllers/paymentController");

const {
    protect,
    authorizeRoles,
} = require("../middleware/authMiddleware");

// Admin only: create a membership payment
router.post(
    "/",
    protect,
    authorizeRoles("admin"),
    createPayment
);

// Admin: Get all payments
router.get(
    "/",
    protect,
    authorizeRoles("admin"),
    getAllPayments
);

//Member: get own payment 
// Member route MUST come before /:id
router.get(
    "/me",
    protect,
    authorizeRoles("member"),
    getMyPayments
);

// Admin: Revenue summary
router.get("/summary", protect, authorizeRoles("admin"), getRevenueSummary);

// Admin: Get payment by id
router.get(
    "/:id",
    protect,
    authorizeRoles("admin"),
    getPaymentById
);

// Admin: update payment status 
router.patch(
    "/:id/status",
    protect,
    authorizeRoles("admin"),
    updatePaymentStatus
);



module.exports = router;

