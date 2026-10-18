const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
    {
        member: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        gymClass: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Class",
            required: true,
        },
        status: {
            type: String,
            enum: ["present", "absent"],
            required: true,
        },
        markedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// One attendance record per member per class
attendanceSchema.index(
    { member: 1, gymClass: 1 },
    { unique: true }
);

const Attendance = mongoose.model("Attendance", attendanceSchema);

module.exports = Attendance;