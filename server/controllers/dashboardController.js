const User = require("../models/User");
const Membership = require("../models/Membership");
const GymClass = require("../models/Class");
const Payment = require("../models/Payment");
const Attendance = require("../models/Attendance");

// Admin: Get dashboard overview
const getDashboardOverview = async (req, res) => {
    try {
        const totalMembers = await User.countDocuments({
            role: "member"
        });

        const activeMemberships = await Membership.countDocuments({
            status: "active"
        });
        
        const totalClasses = await GymClass.countDocuments();

         // Calculate revenue from paid payments only
        const revenueResult = await Payment.aggregate([
            {
                $match: {
                    status: "paid"
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: {
                        $sum: "$amount"
                    }
                }
            }
        ]);

        const totalRevenue = revenueResult[0]?.totalRevenue || 0;


        //attendance 
        const totalAttendance = await Attendance.countDocuments();

        const presentAttendance = await Attendance.countDocuments({
            status: "present"
        });

        const absentAttendance = await Attendance.countDocuments({
            status: "absent"
        });

        const attendanceRate = totalAttendance > 0
            ? Number(((presentAttendance / totalAttendance) * 100).toFixed(2))
            : 0;

        return res.status(200).json({
            totalMembers,
            activeMemberships,
            totalClasses,
            totalRevenue,
            currency: "USD",
            totalAttendance,
            presentAttendance,
            absentAttendance,
            attendanceRate
        });
    } catch (error) {
        console.error("Dashboard overview error:", error);

        return res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
    getDashboardOverview
};