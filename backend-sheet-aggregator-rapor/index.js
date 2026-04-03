require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB } = require('./database');
const apiRoutes = require('./routes/api');
const { initCronJobs } = require('./cron');

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
    const clientKey = req.headers['x-api-key'];
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
initDB().then(() => {
    initCronJobs();
    app.listen(port, () => {

        console.log(`Example app listening at http://localhost:${port}`);
    });
}).catch(err => {
    console.error("Failed to initialize database:", err);
});
