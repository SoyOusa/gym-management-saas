const mongoose = require("mongoose");
const Payment = require("../models/Payment");
const Membership = require("../models/Membership");
const calculateRenewalEndDate = require("../utils/membershipRenewal");
const membershipPlan = require("../config/membershipPlans");
const membershipPlans = require("../config/membershipPlans");

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
    const {id} = req.params;
    const {status} = req.body || {};


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

    const session = await mongoose.startSession();

    try {
        let updatedPayment;

        await session.withTransaction(async () =>{
            //Atoming claim the pending payment.
            //Concurrent confirmatipns cannot both succeed.
            const payment = await Payment.findOneAndUpdate(
                {
                    _id: id,
                    status: "pending",
                },
                {
                    $set: {
                        status,
                        paidAt: status ==="paid" ? new Date() : null,
                    },
                },
                {
                    returnDocument: "after",
                    session,
                }
            );

            if (!payment) {
                const error = new Error(
                    "Payment not found or already finalized"
                );
                error.statusCode = 400;
                throw error;
            }
            
            //Only paid renewal payments extend memberships.

            if ( 
                status === "paid" &&
                payment.purpose === "renewal"
            ) {
                if (
                    !Number.isInteger(payment.renewalMonths) ||
                    payment.renewalMonths < 1 ||
                    payment.renewalMonths > 12 
                ) {
                    const error = new Error(
                        "Invalid renewal months"
                    );
                    error.statusCode = 400;
                    throw error;
                }

                const membership = await Membership.findById(
                    payment.membership
                ).session(session);

                // Check that the membership exists
                if (!membership) {
                    const error = new Error("Membership not found");
                    error.statusCode = 404;
                    throw error;
                }

                // Ensure the payment belongs to the membership owner
                if (payment.member.toString() !== membership.user.toString()) {
                    const error = new Error(
                        "Renewal payment member does not match membership owner"
                    );
                    error.statusCode = 400;
                    throw error;
                }

                // Prevent renewal of cancelled memberships
                if(membership.status === "inactive") {
                    const error = new Error(
                        "Inactive membership cannot be renewed"
                    );
                    error.statusCode = 400;
                    throw error;
                }

                //Validate renewal payment against the membership plan 
                const plan = membershipPlans[membership.membershipType];

                if(!plan) {
                    const error = new Error("Invalid membership plan");
                    error.statusCode = 400;
                    throw error;
                }

                const expectedAmount = plan.monthlyPrice * payment.renewalMonths;

                if(
                    payment.amount !== expectedAmount || 
                    payment.currency !== plan.currency 
                ) {
                    const error = new Error(
                        "Renewal payment amount or currency does not match the membership plan"
                    );
                    error.statusCode = 400;
                    throw error;
                }

                membership.endDate = calculateRenewalEndDate(
                    membership.endDate,
                    payment.renewalMonths
                );

                membership.status = "active";

                await membership.save({session});

                payment.renewalAppliedAt = new Date();
                await payment.save({session});
            }
            updatedPayment = payment;

        });
        return res.status(200).json({
            message: "Payment status updated successfully",
            payment: updatedPayment,

        });
        
    } catch (error) {
        if (!error.statusCode) {
            console.error("Error updating payment status:", error);
        }
        

        return res.status(error.statusCode || 500).json({
            message: error.statusCode 
            ? error.message 
            : "Server error",
        });
    } finally {
        await session.endSession();
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