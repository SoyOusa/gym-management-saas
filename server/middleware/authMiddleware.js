
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            message: "Unauthorized: no token provided",
        });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Unauthorized: invalid token",
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        console.error("Authentication error:", error);

        return res.status(401).json({
            message: "Unauthorized: invalid token",
        });
    }

    try {
        const user = await User.findById(decoded.id)
            .select("-password");

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

        return next();
    } catch (error) {
        console.error("Authentication database error:", error);

        return res.status(500).json({
            message: "Server error",
        });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                message: "Unauthorized: authentication required",
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message:
                    "Forbidden: you do not have permission to access this resource",
            });
        }

        return next();
    };
};

module.exports = {
    protect,
    authorizeRoles,
};
