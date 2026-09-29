const GymClass = require("../models/Class");
const gymClass = require("../models/Class");
const Enrollment = require("../models/Enrollment");

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
}
module.exports = {
    enrollInClass, 
    getMyEnrollments,
}