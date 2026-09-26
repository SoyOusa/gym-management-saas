const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async(req, res, next) => {
    try {
        
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Unauthorized: no token provided",
            });
        }
        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized: user not found",
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                message: "Account is inactive",
            });
        }

        req.user = {
            id: user._id,
            role: user.role,
        };

        next();
    } catch (error) {
        console.error("Authentication error:", error);
        res.status(401).json({
            message: "Unauthorized: invalid token",
        });
    }
};
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: "Forbidden: you do not have permission to access this resource",
            });
        }
        next();
    };
};

module.exports = { protect, authorizeRoles };

