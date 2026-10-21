const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Membership = require("../models/Membership");

const createPayment = async (req, res) => {
    try {
        const {
            membershipId,
            amount,
            paymentMethod,
            transactionId,
        } = req.body || {};

        // Validate required fields
        if (
            !membershipId ||
            amount === undefined ||
            !paymentMethod
        ) {
            return res.status(400).json({
                message:
                    "Membership ID, amount, and payment method are required",
            });
        }

        // Validate membership ID
        if (!mongoose.Types.ObjectId.isValid(membershipId)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        }

        // Validate amount
        if (
            typeof amount !== "number" ||
            !Number.isFinite(amount) ||
            amount <= 0
        ) {
            return res.status(400).json({
                message: "Amount must be a positive number",
            });
        }

        // Validate payment method
        const allowedMethods = [
            "cash",
            "card",
            "bank_transfer",
        ];

        if (!allowedMethods.includes(paymentMethod)) {
            return res.status(400).json({
                message: "Invalid payment method",
            });
        }

        // Find membership
        const membership = await Membership.findById(membershipId);

        if (!membership) {
            return res.status(404).json({
                message: "Membership not found",
            });
        }

        // Create a pending payment
        const payment = await Payment.create({
            member: membership.user,
            membership: membership._id,
            amount,
            paymentMethod,
            transactionId,
            status: "pending",
        });

        return res.status(201).json({
            message: "Payment created successfully",
            payment,
        });
    } catch (error) {
        console.error("Error creating payment:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
};

// Admin: Get all payments
const getAllPayments = async (req, res) => {
    try {
        const payments = await Payment.find()
            .populate("member", "firstName lastName email")
            .populate("membership", "membershipType status")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            count: payments.length,
            payments,
        });
    } catch (error) {
        console.error("Error fetching payments:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
};

// Admin: Get payment by ID
const getPaymentById = async (req, res) => {
    try {
        const { id } = req.params;

        // Validate payment ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid payment ID",
            });
        }

        // Find payment
        const payment = await Payment.findById(id)
            .populate("member", "firstName lastName email")
            .populate("membership", "membershipType status");

        if (!payment) {
            return res.status(404).json({
                message: "Payment not found",
            });
        }

        return res.status(200).json({
            payment,
        });
    } catch (error) {
        console.error("Error fetching payment:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
};

// Admin: Update payment status
const updatePaymentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body || {};

        // Validate payment ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid payment ID",
            });
        }

        // Validate new status
        if (!["paid", "failed"].includes(status)) {
            return res.status(400).json({
                message: "Status must be paid or failed",
            });
        }

        // Find payment
        const payment = await Payment.findById(id);

        if (!payment) {
            return res.status(404).json({
                message: "Payment not found",
            });
        }

        // Prevent changing finalized payments
        if (payment.status !== "pending") {
            return res.status(400).json({
                message: "Only pending payments can be updated",
            });
        }

        payment.status = status;

        if (status === "paid") {
            payment.paidAt = new Date();
        }

        await payment.save();

        return res.status(200).json({
            message: "Payment status updated successfully",
            payment,
        });
    } catch (error) {
        console.error("Error updating payment status:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
};

//Member: Get own payment history 
const getMyPayments = async(req,res) => {
    try{
        const payments = await Payment.find({
            member: req.user.id,
        })
            .populate("membership", "membershipType stats startDate endDate")
            .sort({createdAt: -1});
        
        return res.status(200).json({
            count: payments.length,
            payments,
        });
    } catch (error) {
        console.error("Error fetching member payments", error);

        return res.status(500).json({
            message:"Server error",
        });
    }
};

// Admin: Get revenue summary
const getRevenueSummary = async (req, res) => {
    try {
        const summary = await Payment.aggregate([
            {
                $group: {
                    _id: null,
                    totalPayments: { $sum: 1 },

                    paidPayments: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "paid"] }, 1, 0]
                        }
                    },

                    pendingPayments: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "pending"] }, 1, 0]
                        }
                    },

                    failedPayments: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "failed"] }, 1, 0]
                        }
                    },

                    refundedPayments: {
                        $sum: {
                            $cond: [{ $eq: ["$status", "refunded"] }, 1, 0]
                        }
                    },

                    totalRevenue: {
                        $sum: {
                            $cond: [
                                { $eq: ["$status", "paid"] },
                                "$amount",
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const result = summary[0] || {
            totalPayments: 0,
            paidPayments: 0,
            pendingPayments: 0,
            failedPayments: 0,
            refundedPayments: 0,
            totalRevenue: 0
        };

        return res.status(200).json({
            currency: "USD",
            totalPayments: result.totalPayments,
            paidPayments: result.paidPayments,
            pendingPayments: result.pendingPayments,
            failedPayments: result.failedPayments,
            refundedPayments: result.refundedPayments,
            totalRevenue: result.totalRevenue
        });

    } catch (error) {
        console.error("Revenue summary error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};
module.exports = {
    createPayment,
    getAllPayments,
    getPaymentById,
    updatePaymentStatus,
    getMyPayments,
    getRevenueSummary
};