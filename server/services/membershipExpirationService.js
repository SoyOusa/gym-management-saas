const Membership = require("../models/Membership");

// Mark active memberships as expired when their end date has passed
const expireMemberships = async () => {
    try {
        const now = new Date();

        const result = await Membership.updateMany(
            {
                status: "active",
                endDate: { $lt: now }
            },
            {
                $set: { status: "expired" }
            }
        );

        console.log(
            `Membership expiration check: ${result.modifiedCount} memberships expired`
        );

        return result.modifiedCount;

    } catch (error) {
        console.error("Membership expiration error:", error);
        throw error;
    }
};

module.exports = {
    expireMemberships
};