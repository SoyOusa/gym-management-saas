const mongoose = require("mongoose");
const Membership = require("../models/Membership");

const getAllMemberships = async (req, res) => {
    try {
        const memberships = await Membership.find()
            .populate("user", "-password");

        res.status(200).json({
            memberships,
        });

    } catch (error) {
        console.error("Error fetching all memberships:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};

//get membership by id 
const getMembershipById = async (req , res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        }
        const membership = await Membership.findById(req.params.id)
        .populate("user", "-password");

        if (!membership) {
            return res.status(404).json({
                message: "Membership not found",
            });
        }
        res.status(200).json({
            membership,
        });
        
    } catch (error) {
        console.error("Error fetching membership", error);

        res.status(500).json({
            message: "Server Error",
        });
    }
}

//update membership 
const updateMembership = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        }

        const {
            membershipType,
            startDate,
            endDate,
            status,
        } = req.body;

        const membership = await Membership.findById(req.params.id);

        if (!membership) {
            return res.status(404).json({
                message: "Membership not found",
            });
        }

        if (membershipType !== undefined) {
            membership.membershipType = membershipType;
        }

        if (startDate !== undefined) {
            membership.startDate = startDate;
        }

        if (endDate !== undefined) {
            membership.endDate = endDate;
        }

        if (status !== undefined) {
            membership.status = status;
        }

        await membership.save();

        const updatedMembership = await Membership.findById(membership._id)
            .populate("user", "-password");

        res.status(200).json({
            message: "Membership updated successfully",
            membership: updatedMembership,
        });

    } catch (error) {
        console.error("Error updating membership:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};

//delete membership 
const deleteMembership = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        }

        const membership = await Membership.findByIdAndDelete(
            req.params.id
        );

        if (!membership) {
            return res.status(404).json({
                message: "Membership not found",
            });
        }

        res.status(200).json({
            message: "Membership deleted successfully",
        });

    } catch (error) {
        console.error("Error deleting membership:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};

//admin cancel membership 
const cancelMembership = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        }

        const membership = await Membership.findById(req.params.id);

        if (!membership) {
            return res.status(404).json({
                message: "Membership not found",
            });
        }

        membership.status = "inactive";

        await membership.save();

        const updatedMembership = await Membership.findById(membership._id)
            .populate("user", "-password");

        res.status(200).json({
            message: "Membership cancelled successfully",
            membership: updatedMembership,
        });

    } catch (error) {
        console.error("Error cancelling membership:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};

module.exports = {
    getAllMemberships,
    getMembershipById,
    updateMembership,
    deleteMembership,
    cancelMembership
};