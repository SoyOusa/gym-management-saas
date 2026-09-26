const User = require("../models/User");
const Membership = require("../models/Membership");

const getDashboardStats = async (req, res) =>{
    try {
        const totalUsers = await User.countDocuments();
        
        const activeUsers = await User.countDocuments({
            isActive: true,
        });

        const inactiveUsers = await User.countDocuments({
            isActive: false,
        });

        const totalMemberships = await Membership.countDocuments();
        
        const activeMemberships = await Membership.countDocuments({
            status: "active",
        });

        const inactiveMemberships = await Membership.countDocuments({
            status: "inactive",
        });

        const expiredMemberships = await Membership.countDocuments({
            status: "expired",
        });
        res.status(200).json({
            users: {
                total: totalUsers,
                active: activeUsers,
                inactive: inactiveUsers,
            },
            memberships: {
                total: totalMemberships,
                active: activeMemberships,
                inactive: inactiveMemberships,
                expired: expiredMemberships,
            },
        });
    } catch (error){
        console.error("Error fetching dashboard stats:", error);
        
        res.status(500).json({
            message:"Server error",
        });
    }
}

module.exports = {
    getDashboardStats,
};