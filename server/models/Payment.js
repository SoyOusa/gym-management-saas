const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
    {
        member: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        membership: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Membership",
            required: true,
        },

        purpose: {
            type: String,
            enum: ["membership", "renewal"],
            default: "membership",
        },
        
        renewalMonths: {
            type: Number,
            min: 1, 
            max: 12,
            validate: {
                validator: Number.isInteger,
                message: "Renewal months must be an integer",
            },
        },

        renewalAppliedAt: {
            type: Date, 
            default: null,
        },

        amount: {
            type: Number,
            required: true,
            min: 0,
        },

        currency: {
            type: String,
            enum: ["USD"],
            default: "USD",
        },

        paymentMethod: {
            type: String,
            enum: ["cash", "card", "bank_transfer"],
            required: true,
        },

        status: {
            type: String,
            enum: ["pending", "paid", "failed", "refunded"],
            default: "pending",
        },

        transactionId: {
            type: String,
            trim: true,
        },

        paidAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Allow only one pending renewal per membership
paymentSchema.index(
    { membership: 1 },
    {
        unique: true,
        partialFilterExpression: {
            purpose: "renewal",
            status: "pending",
        },
    }
);


const Payment = mongoose.model("Payment", paymentSchema);

module.exports = Payment;