const membershipPlans = {
    basic: {
        name: "Basic",
        monthlyPrice: 30,
        currency: "USD",
        benefits: {
            gymAccess: true,
            lockerAccess: true,
            groupClassesPerMonth: 4,
            premiumClasses: false,
            personalTrainingSessionsPerMonth: 0,
            personalizedWorkoutPlan: false,
            priorityBooking: false,
        },
    },

    premium: {
        name: "Premium",
        monthlyPrice: 75,
        currency: "USD",
        benefits: {
            gymAccess: true,
            lockerAccess: true,
            groupClassesPerMonth: null, // Unlimited
            premiumClasses: true,
            personalTrainingSessionsPerMonth: 2,
            personalizedWorkoutPlan: true,
            priorityBooking: true,
        },
    },
};

module.exports = membershipPlans;