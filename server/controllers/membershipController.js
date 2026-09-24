const mongoose = require("mongoose");
const Membership = require("../models/Membership");

// Create a new membership
const createMembership = async (req, res) => {
    try {
        console.log("Authenticated user:", req.user);
        const { membershipType, startDate, endDate } = req.body;

        // validate required fields
        if ( !membershipType || !startDate || !endDate) {
            return res.status(400).json({
                message: "Please provide membership type, start date, and end date",
            });
        }
        
        // Create membership
        const newMembership = await Membership.create({
            user: req.user.id,
            membershipType,
            startDate,
            endDate,
        });
        res.status(201).json({
            message: "Membership created successfully",
            membership: newMembership,
        });

    } catch (error) {
        console.error("Error creating membership:", error);
        res.status(500).json({
            message: "Server error",
        });
    }
};

const getMyMemberships = async (req, res) => {
    try {
        const memberships = await Membership.find({
            user: req.user.id,
        });
        res.status(200).json({memberships});
    } catch (error) {
        console.error("Error fetching membership", error),

        res.status(500).json({
            message: "Server Error"
        });
    }
};

//get membership by ID 
const getMembershipById = async (req, res) =>{
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            })
        }
        const membership = await Membership.findOne({
            _id: req.params.id,
            user: req.user.id,
        });
        if (!membership) {
            return res.status(404).json({
                message: "Membership not found",
            });
        }
        return res.status(200).json({
            membership
        });
    } catch (error) {
        console.error("failed to fetch membership", error);
        
        return res.status(500).json({
            message: "Server Error",
        });
    }
}

//update membership 
const updateMembership = async( req, res)=>{
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        
        }
        const {membershipType, startDate, endDate, status} = req.body;

        const membership = await Membership.findOne({
            _id: req.params.id,
            user: req.user.id,
        });

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

        res.status(200).json({
            message: "Membership updated successfully",
            membership,
        });
    } catch (error) {
        console.log("Error updating membership:", error);

        res.status(500).json({
            message:"Server Error",
        })
    }
}
module.exports = {createMembership, getMyMemberships, getMembershipById, updateMembership};