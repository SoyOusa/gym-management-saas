const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            required: true,
            trim: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique:true,
            lowercase:true,
            trim:true,
        },
        password: {
            type: String,
            required: true,
            minlength: 6,
        },
        role:{
            type: String,
            enum: ["admin", "trainer", "member"],
            default: "member",
        },
        phone:{
            type: String,
            trim:true,
        },
        isActive:{
            type:Boolean,
            default: true,
        },
    },
    {
        timestamps:true,
    }
);

const User = mongoose.model("User", userSchema);

module.exports = User;