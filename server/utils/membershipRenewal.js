const calculateRenewalEndDate = (currentEndDate, months) => {
    if (!Number.isInteger(months) || months < 1 || months > 12) {
        throw new Error("Renewal months must be between 1 and 12");
    }

    const now = new Date();
    const currentEnd = new Date(currentEndDate);

    if (Number.isNaN(currentEnd.getTime())) {
        throw new Error("Invalid membership end date");
    }

    // Extend from the existing end date if it is still in the future.
    // Otherwise, extend from today.
    const baseDate = currentEnd > now ? currentEnd : now;

    const year = baseDate.getUTCFullYear();
    const month = baseDate.getUTCMonth();
    const day = baseDate.getUTCDate();

    // Calculate the destination month without overflowing dates.
    const targetMonthStart = new Date(
        Date.UTC(year, month + months, 1)
    );

    const lastDayOfTargetMonth = new Date(
        Date.UTC(year, month + months + 1, 0)
    ).getUTCDate();

    return new Date(
        Date.UTC(
            targetMonthStart.getUTCFullYear(),
            targetMonthStart.getUTCMonth(),
            Math.min(day, lastDayOfTargetMonth),
            baseDate.getUTCHours(),
            baseDate.getUTCMinutes(),
            baseDate.getUTCSeconds(),
            baseDate.getUTCMilliseconds()
        )
    );
};

module.exports = calculateRenewalEndDate;