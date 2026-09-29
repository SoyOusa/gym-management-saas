const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema(
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
    },
    {
        timestamps: true,
    }
    
);

enrollmentSchema.index(
    {member: 1, gymClass: 1},
    {unique: true}
)

const Enrollment = mongoose.model("Enrollment", enrollmentSchema);

module.exports = Enrollment;