const GymClass = require("../models/Class");
const User = require("../models/User");
const mongoose = require("mongoose");

const createClass = async (req, res)=>{
    try {
        const {
            name, 
            description,
            trainer, 
            date,
            startTime,
            endTime,
            capacity,
        } = req.body;
    
        if (!name || !trainer || !date || !startTime || !endTime || capacity === undefined) {
            return res.status(400).json({
                message: "Please provide all required class fields",
            });
        } 

        // console.log("Trainer ID received:", trainer);
        const trainerUser = await User.findById(trainer);

        // console.log("Trainer user found:", trainerUser);
        // console.log("Trainer role:", trainerUser?.role);
        
        if (!trainerUser) {
            return res.status(404).json({
                message:"Trainer not found",
            });
        }

        if (trainerUser.role !== "trainer") {
            return res.status(400).json({
                message: "selected user is not a trainer",
            });
        }

        if (capacity < 1 ) {
            return res.status(400).json({
                message:"Capacity must be at least 1",
            });
        }
        const newClass = await GymClass.create({
            name, description, trainer, date, startTime, endTime, capacity,
        });
        
        const populatedClass = await GymClass.findById(newClass._id)
            .populate("trainer", "-password");

        res.status(201).json({
            message:"Class created successfully",
            class: populatedClass,
        });
    } catch (error) {
        console.error("Error creating class", error);

        res.status(500).json({
            message:"Server error",
        });
    }
};

// let authenticated users view the gym classes

const getAllClasses = async(req, res) =>  {
    try {
        const classes = await GymClass.find()
        .populate("trainer", "-password")
        .sort({date: 1, startTime: 1 });

        res.status(200).json({
            classes,
        });
    } catch (error) {
        console.error("Error fetching classes:", error);
        
        res.status(500).json({
            message:"Server error",
        });
    }
};

//get class by its ID 

const getClassById = async(req,res) =>{
    try {
        if(!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message:"Invalid class ID"
            });
        }

        const gymClass = await GymClass.findById(req.params.id)
            .populate("trainer", "-password");

        if (!gymClass) {
            return res.status(404).json({
                message:"Class not found",
            });
        }
        res.status(200).json({
            class: gymClass,
        });
    } catch (error) {
        console.error("Error fetching class:", error);

        res.status(500).json({
            message:"Server error",
        });
    }
};

// update class
const updateClass = async(req, res) => {
    try{
        if(!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message:"Invalid class ID"
            });
        }
        const {
            name, 
            description, 
            trainer, 
            date, 
            startTime, 
            endTime, 
            capacity,
        }    = req.body;

        const gymClass = await GymClass.findById(req.params.id);

        if (!gymClass) {
            return res.status(400).json({
                message:"Class not found",
            });
        }

        if (name !== undefined) {
            gymClass.name = name;
        }

        if (description !== undefined) {
            gymClass.description = description;
        }

        if (trainer !== undefined) {
            const trainerUser = await User.findById(trainer);

            if (!trainerUser) {
                return res.status(404).json({
                    message: "Trainer not found",
                });
            }

            if (trainerUser.role !== "trainer") {
                return res.status(400).json({
                    message: "Selected user is not a trainer",
                });
            }
            gymClass.trainer = trainer;
        }

        if (date !== undefined) {
            const newDate = new Date(date);

            if (Number.isNaN(newDate.getTime())) {
                return res.status(400).json({
                    message: "Date must be a valid date",
                });
            }
            gymClass.date = date;   
        }

        if (startTime !== undefined) {
            gymClass.startTime = startTime;
        }

        if (endTime !== undefined) {
            gymClass.endTime = endTime;
        }

        const finalStartTime = gymClass.startTime;
        const finalEndTime = gymClass.endTime;

        if (finalEndTime <= finalStartTime) {
            return res.status(400).json({
                message: "End time must be after start time",
            });
        }

        if (capacity !== undefined) {
            if (capacity < 1) {
                return res.status(400).json({
                    message: "Capacity must be at least 1",
                });
            }

            gymClass.capacity = capacity;
        }

        await gymClass.save();

        const updatedClass = await GymClass.findById(gymClass._id)
            .populate("trainer","-password");
        
        res.status(200).json({
            message: "Class updated successfully",
            class: updatedClass,
        });
    } catch (error) {
        console.error("Error updating class:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};

const deleteClass = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                message: "Invalid class ID",
            });
        }

        const gymClass = await GymClass.findById(req.params.id);

        if (!gymClass) {
            return res.status(404).json({
                message: "Class not found",
            });
        }

        await GymClass.findByIdAndDelete(req.params.id);

        res.status(200).json({
            message: "Class deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting class:", error);

        res.status(500).json({
            message: "Server error",
        });
    }
};
module.exports = {
    createClass,
    getAllClasses,
    getClassById,
    updateClass,
    deleteClass
};