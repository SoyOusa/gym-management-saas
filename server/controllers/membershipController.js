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

module.exports = {createMembership, getMyMemberships};