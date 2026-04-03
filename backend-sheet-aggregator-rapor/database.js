const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db;

async function initDB() {
    const dbPath = process.env.DB_PATH || './database/database.sqlite';
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS sync_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            step_name TEXT,
            status TEXT,
            message TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS rapor_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nav_tree TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    
    console.log('Database initialized.');
}

async function logStep(stepName, status, message) {
    if (!db) return;
    await db.run(
        `INSERT INTO sync_logs (step_name, status, message) VALUES (?, ?, ?)`,
        [stepName, status, message]
    );
}

async function clearLogs() {
    if (!db) return;
    await db.run(`DELETE FROM sync_logs`);
}

async function getLogs() {
    if (!db) return [];
    return await db.all(`SELECT * FROM sync_logs ORDER BY timestamp ASC`);
}

async function saveNavTree(navTreeJson) {
    if (!db) return;
    await db.run(
        `INSERT INTO rapor_data (nav_tree) VALUES (?)`,
        [JSON.stringify(navTreeJson)]
    );
}

async function getLatestNavTree() {
    if (!db) return null;
    const row = await db.get(`SELECT nav_tree FROM rapor_data ORDER BY created_at DESC LIMIT 1`);
    if (row && row.nav_tree) {
        try {
            return JSON.parse(row.nav_tree);
        } catch (e) {
            return null;
        }
    }
    return null;
}

module.exports = {
    initDB,
    logStep,
    clearLogs,
    getLogs,
    saveNavTree,
    getLatestNavTree
};
