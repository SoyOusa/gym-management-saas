const mongoose = require("mongoose");
const User = require("../models/User");

// Get all users
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");

        res.status(200).json({
            users,
        });

    } catch (error) {
        console.error("Error fetching users:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};


// Get user by ID
const getUserById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid user ID",
            });
        }

        const user = await User.findById(req.params.id).select("-password");

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        res.status(200).json({
            user,
        });

    } catch (error) {
        console.error("Error fetching user:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};


// Update user
const updateUser = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid user ID",
            });
        }

        const {
            firstName,
            lastName,
            email,
            phone,
            isActive,
            role,
        } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        if (firstName !== undefined) {
            user.firstName = firstName;
        }

        if (lastName !== undefined) {
            user.lastName = lastName;
        }

        if (email !== undefined) {
            user.email = email;
        }

        if (phone !== undefined) {
            user.phone = phone;
        }

        if (isActive !== undefined) {
            user.isActive = isActive;
        }

        if (role !== undefined) {
            user.role = role;
        }

        await user.save();

        const updatedUser = user.toObject();

        delete updatedUser.password;

        res.status(200).json({
            message: "User updated successfully",
            user: updatedUser,
        });

    } catch (error) {
        console.error("Error updating user:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};


module.exports = {
    getAllUsers,
    getUserById,
    updateUser,
};