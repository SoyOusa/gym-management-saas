const mongoose = require("mongoose");
const Membership = require("../models/Membership");
const membershipPlans = require("../config/membershipPlans");
const Payment = require("../models/Payment");

// Create a new membership
const createMembership = async (req, res) => {
    try {
        console.log("Authenticated user:", req.user);
        const { membershipType, startDate, endDate } = req.body;
        
        //validate membership type 

        if(!["basic","premium"].includes(membershipType)) {
            return res.status(400).json({
                message: "Membership type must be basic or premium",
            });
        }
        //validate membership date
        if (!startDate || !endDate) {
            return res.status(400).json({
                message:"Start date and end date are required",
            });
        }
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
            return res.status(400).json({
                message:"Start date and end date must be valid",
            });
        }
        if (end <= start) {
            return res.status(400).json({
                message:"End date must be after start",
            });
        }

        //validate to prevent a member from creating a new membership that overlaps an existing active membership 
        const existingActiveMembership = await Membership.findOne({
            user: req.user.id,
            status: "active",
            startDate: { $lt: end },
            endDate: { $gt: start },
        });

        if (existingActiveMembership) {
            return res.status(400).json({
                message: "You already have an active membership during this period",
            });
        }
        
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

        const now = new Date();

        for (const membership of memberships) {
            if (
                membership.status === "active" && 
                membership.endDate < now
            ) {
                membership.status = "expired";
                await membership.save();
            }
        }
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

const updateMembership = async (req, res) => {
    return res.status(403).json({
        message:
            "Membership plan and dates cannot be changed directly. Please use the approved payment or admin process.",
    });
};

   

//delete membership 

const deleteMembership = async(req,res) =>{
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        };
        const membership = await Membership.findOne({
            _id: req.params.id,
            user: req.user.id
        })
        if (!membership) {
            return res.status(404).json({
                message: "Membership not found"
            });
        }
        await Membership.deleteOne({
            _id: req.params.id,
            user: req.user.id
        });
        res.status(200).json({
            message:"Membership deleted successfully",
        });
    } catch (error) {
        console.error("error deleting membership:", error);

        res.status(500).json({
            message: "Server error",
        });
    };
}

//cancel membership
const cancelMembership = async (req, res)=> {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid membership ID"
            });
        }
        const membership = await Membership.findOne({
            _id: req.params.id,
            user: req.user.id
        });
        if (!membership) {
            return res.status(404).json({
                message: "Membership not found",
            });
        }

        if (membership.status !== "active") {
            return res.status(400).json({
                message: `Membership is already ${membership.status}`,
            });
        }

        membership.status = "inactive";

        await membership.save();
        
        return res.status(200).json({
            message:"Membership cancelled successfully",
            membership,
        });
    } catch (error) {
        console.error("Error cancelling membership")
        
        res.status(500).json({
            message:"Server error",
        });
    }
};

// Renew an existing membership 
const renewMembership = async (req,res) =>{
    try {
        const {id} = req.params;
        const {months} = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid membership ID",
            });
        }
        
        if (!Number.isInteger(months) || months < 1 || months > 12) {
            return res.status(400).json({
                message: "Months must be an integer between 1 and 12",
            });
        }

        const membership = await Membership.findOne({
            _id: id,
            user: req.user.id,
        });

        if (!membership) {
            return res.status(404).json({
                message:"Membership not found",
            });
        }

        if (membership.status ==="inactive") {
            return res.status(400).json({
                message: "Cancelled memberships cannot be renewed",
            });
        }

        // Calculate renewal price using server-defined membership plans
        const plan = membershipPlans[membership.membershipType];

        if (!plan) {
            return res.status(400).json({
                message: "Invalid membership plan",
            });
        }

        const renewalAmount = plan.monthlyPrice * months;

        // Prevent multiple pending renewals for the same membership
        const existingPendingRenewal = await Payment.findOne({
            membership: membership._id,
            purpose: "renewal",
            status: "pending",
        });

        if (existingPendingRenewal) {
            return res.status(409).json({
                message: "A renewal payment is already pending for this membership",
            });
        }

        // Create a pending renewal payment
        const payment = await Payment.create({
            member: req.user.id,
            membership: membership._id,
            purpose: "renewal",
            renewalMonths: months,
            amount: renewalAmount,
            currency: plan.currency,
            paymentMethod: "bank_transfer",
            status: "pending",
        });

        return res.status(201).json({
            message: "Renewal payment created successfully",
            payment,
        });
    } catch(error) {
        //MongoDB unique index violation 
        if (error.code === 11000) {
            return res.status(409).json({
                message: "A renewal payment is already pending for this membership",
            });
        }

        console.error("Error renewing membership:", error);
        
        return res.status(500).json({
            message:"Server Error",
        });
    }
};

module.exports = {
    createMembership, 
    getMyMemberships, 
    getMembershipById, 
    updateMembership, 
    deleteMembership,
    cancelMembership,
    renewMembership,
};