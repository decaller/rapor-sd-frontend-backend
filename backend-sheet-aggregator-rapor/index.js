require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB, getLatestNavTree } = require('./database');
const apiRoutes = require('./routes/api');
const { initCronJobs } = require('./cron');
const { runSync } = require('./services/syncService');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3000;

// ─── API Key Middleware (The Bouncer) ────────────────────────────────────────
// Protects all /api routes by requiring a matching x-api-key header.
// Set API_SECRET_KEY in your .env file. Generate a strong key with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
if (!process.env.API_SECRET_KEY) {
    console.warn('⚠️  WARNING: API_SECRET_KEY is not set in .env. All /api routes are unprotected!');
}

const requireApiKey = (req, res, next) => {
    // Also check query string for easy browser testing: ?api_key=your_key
    const clientKey = req.headers['x-api-key'] || req.query.api_key;
    if (!clientKey || clientKey !== process.env.API_SECRET_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid or missing API Key.' });
    }
    next();
};

// Apply the API key check to ALL /api/* routes
app.use('/api', requireApiKey);

app.use('/api/rapor', apiRoutes);

app.get('/', (req, res) => {
  res.send('Rapor Sync API is running.');
});

// Initialize DB then start server
initDB().then(async () => {
    initCronJobs();

    // Auto-run sync on first start if no data exists or if explicitly requested
    const latestData = await getLatestNavTree();
    if (!latestData || process.env.RUN_SYNC_ON_STARTUP === 'true') {
        console.log("First time run detected (or RUN_SYNC_ON_STARTUP is true), starting initial sync...");
        // Run asynchronously so we don't block the server startup
        runSync().catch(err => console.error("Initial sync on startup failed:", err));
    }

    app.listen(port, () => {
        console.log(`Example app listening at http://localhost:${port}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
