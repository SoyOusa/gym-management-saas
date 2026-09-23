const bcrypt = require("bcryptjs");
const User = require("../models/User");

const registerUser = async(req, res)=> {
    try {
        const {firstName, lastName, email, password, phone} = req.body;

        //Validate required fields 
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                message: "Please provide first name, last name, email, and password",
            });
        }
        //Check whether user already exists 
        const existingUser = await User.findOne({email});

        if(existingUser) {
            return res.status(400).json({
                message: "a user with this email already exists",
            });
        }
        //Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        //Create user
        const user = await User.create({
            firstName, 
            lastName,
            email,
            password: hashedPassword,
            phone,
        });
        res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            },
        });

    } catch (error) {
        console.error("Registration error:", error);

        res.status(500).json({
            message: "Server error"
        });
    }       
}

const loginUser = async (req, res)=> {
    try {
        const {email, password} = req.body;
        // validate required fields 
        if (!email || !password) {
            return res.status(400).json({
                message: "Please provide email and password",
            });
        }
         //find user by email 
        const user = await User.findOne({email});

        if(!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }
        //compare password with hashed password 
        const isPasswordCorrect = await bcrypt.compare(
            password, 
            user.password
        );
        if (!isPasswordCorrect) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        //login successful 
        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
            },
        });
        
    } catch (error) {
        console.error("login error:", error);

        res.status(500).json({
            message: "Server error",
        });
    } 
};
module.exports = {
    registerUser, loginUser,
};