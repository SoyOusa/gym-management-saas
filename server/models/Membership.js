const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    membershipType: {
        type: String,
        enum: ["basic", "premium"],
        required: true,
    },
    startDate: {
        type: Date,
        required: true,
    },
    endDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ["active", "inactive", "expired"],
        default: "active",
    },
}, {
    timestamps: true,
});

const Membership = mongoose.model("Membership", membershipSchema);

module.exports = Membership;