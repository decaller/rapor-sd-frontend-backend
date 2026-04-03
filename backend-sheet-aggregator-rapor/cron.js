const cron = require('node-cron');
const { runSync } = require('./services/syncService');
const { clearLogs } = require('./database');

function initCronJobs() {
    // Run daily at 2:00 AM
    cron.schedule('0 2 * * *', async () => {
        console.log("Running scheduled Rapor Sync process...");
        try {
            await clearLogs();
            await runSync();
        } catch (error) {
            console.error("Automated cron job failed:", error);
        }
    });

    console.log("Cron schedules initialized (Daily at 2:00 AM).");
}

module.exports = { initCronJobs };
