const GymClass = require("../models/Class");
const gymClass = require("../models/Class");
const Enrollment = require("../models/Enrollment");
const Membership = require("../models/Membership");
const mongoose = require("mongoose");

const enrollInClass = async(req, res) => {
    try {
        const { classId } = req.body;
        
        if(!classId) {
            return res.status(400).json({
                message: "Class ID is required",
            });
        }
    
        const gymClass = await GymClass.findById(classId);

        if(!gymClass) {
            return res.status(404).json({
                message: "Class not found",
            });
        }

        const existingEnrollment = await Enrollment.findOne({
            member: req.user.id,
            gymClass: classId,
        });

        const activeMembership = await Membership.findOne({
            user: req.user.id,
            status: "active",
            endDate: {$gt: new Date()},
        });

        if (!activeMembership) {
            return res.status(400).json({
                message: "You need an active membership to enroll in class",
            });
        }
        const enrollmentCount = await Enrollment.countDocuments({
            gymClass: classId,
        })

        if (enrollmentCount >= gymClass.capacity) {
            return res.status(400).json({
                message: "Class is full",
            });
        }

        if (existingEnrollment) {
            return res.status(400).json({
                message: "You are already enrolled in this class",

            });
        }

        const enrollment = await Enrollment.create({
            member: req.user.id,
            gymClass: classId,
        });

        res.status(201).json({
            message: "Successfully enrolled in class",
            enrollment,
        });
    } catch (error) {
        console.error("Error enrolling in class:", error);

        res.status(500).json({
            message: "Server error",
        });

    }

};

// view member's enrollments 

const getMyEnrollments = async ( req,res ) => {
    try {
        const enrollments = await Enrollment.find({
            member: req.user.id,
        })
            .populate({
                path: "gymClass",
                populate: {
                    path: "trainer", 
                    select: "-password",
                },    
            })
            .sort({ createAt: -1});
        res.status(200).json({
            enrollments,
        });
    } catch (error) {
        console.error("Error fetching enrollments:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};

// cancel enrollment 
const cancelEnrollment = async(req, res) => {
    try {
         
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message:"Invalid enrollment ID"
            });
        }
        const enrollment = await Enrollment.FindOne({
            _id: req.params.id,
            member: req.user.id
        });

        if (!enrollment) {
            return res.status(404).json({
                message:"Enrollment not found",
            });
        }

        await Enrollment.findByIdAndDelete(enrollment._id);

        res.status(200).json({
            message: "Enrollment cancelled successfully",
        });

    } catch (error) {
        console.error("Error cancelling enroullment:", error);

        return res.status(500).json({
            message:"Server error",
        });
    }
};

const getAllEnrollments = async (req,res) => {
    try {
        const enrollments = await Enrollment.find()
            .populate("member", "-password")
            .populate({
                path: "gymClass",
                populate: {
                    path: "trainer",
                    select:"-password",
                },
            })
            .sort({ createdAt: -1});

        res.status(200).json({
            enrollments,
        });
    } catch (error) {
        console.error("Error fetching all enrollments", error);

        //handle duplicate enrollment error

    if (error.code === 11000) {
        return res.status(400).json({
            message: "You are already enrolled in this class",
        });
    }

        res.status(500).json({
            message:"Server error",
        });
    }
};

// get enrollment summary

const getEnrollmentSummary = async(req,res) => {
    try {
        const totalEnrollments = await Enrollment.countDocuments();

        res.status(200).json({
            totalEnrollments,
        });
    } catch (error) {
        console.error("Error fetching enrollment summary:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
}

// get enrollment by its ID

const getEnrollmentById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid enrollment ID",
            });
        }

        const enrollment = await Enrollment.findOne({
            _id: req.params.id,
            member: req.user.id,
        })
            .populate("member", "-password")
            .populate({
                path: "gymClass",
                populate: {
                    path: "trainer",
                    select: "-password",
                },
            });

        if (!enrollment) {
            return res.status(404).json({
                message: "Enrollment not found",
            });
        }

        res.status(200).json({
            enrollment,
        });
    } catch (error) {
        console.error("Error fetching enrollment:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};

module.exports = {
    enrollInClass, 
    getMyEnrollments,
    cancelEnrollment,
    getAllEnrollments,
    getEnrollmentSummary,
    getEnrollmentById,
}