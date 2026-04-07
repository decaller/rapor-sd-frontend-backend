const { google } = require('googleapis');
const { Readable } = require('stream');

// ── Google Auth ───────────────────────────────────────────────────────────────
// Credentials are loaded from environment variables instead of a JSON file.
// This makes deployment easier: no file to upload, just set 3 env vars.
//
//   GCP_PROJECT_ID   → "project_id" from your service account JSON
//   GCP_CLIENT_EMAIL → "client_email" from your service account JSON
//   GCP_PRIVATE_KEY  → "private_key" from your service account JSON
//                      (copy the full value including -----BEGIN PRIVATE KEY-----)
//
// The private key is stored as a single line with literal \n characters in .env.
// We replace them with real newlines here so the RSA key parses correctly.

let auth = null;
if (process.env.GCP_CLIENT_EMAIL && process.env.GCP_PRIVATE_KEY) {
    const credentials = {
        project_id: process.env.GCP_PROJECT_ID,
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };
    auth = new google.auth.GoogleAuth({
        credentials,
        scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/spreadsheets.readonly'
        ],
    });
} else {
    console.warn('⚠️  Warning: GCP_CLIENT_EMAIL or GCP_PRIVATE_KEY not set! Google APIs will not work.');
}

const drive = auth ? google.drive({ version: 'v3', auth }) : null;
const sheets = auth ? google.sheets({ version: 'v4', auth }) : null;

/**
 * Helper to retry an async function with exponential backoff on quota/transient errors.
 */
async function withRetry(fn, maxRetries = 5, initialDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error.code || (error.response && error.response.status);
            const isQuotaError = status === 429 || (status === 403 && error.message.toLowerCase().includes('quota'));
            const isTransientError = status === 500 || status === 502 || status === 503 || status === 504;

            if (isQuotaError || isTransientError) {
                const delay = initialDelay * Math.pow(2, i);
                console.warn(`⚠️ Google API Error (${status}): ${error.message}. Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error; // Permanent error, don't retry
        }
    }
    throw lastError; // Max retries reached
}

/**
 * Lists contents of a specific folder
 */
async function getFolderContents(folderId) {
    if (!drive) throw new Error('Google API auth not initialized. Please set GCP_CLIENT_EMAIL and GCP_PRIVATE_KEY in your .env file.');
    return withRetry(async () => {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed = false`,
            fields: 'files(id, name, mimeType)',
            pageSize: 1000,
        });
        return res.data.files;
    });
}

/**
 * Fetches basic metadata for a spreadsheet (e.g. tab names and IDs)
 */
async function getSpreadsheetMetadata(spreadsheetId) {
    if (!sheets) throw new Error("Google API auth not initialized.");
    return withRetry(async () => {
        const res = await sheets.spreadsheets.get({
            spreadsheetId,
            fields: 'sheets.properties'
        });
        return res.data.sheets.map(sheet => sheet.properties);
    });
}

/**
 * Reads raw cell values from a given range or sheet name.
 * Returns a 2D array (rows x cols). First row is typically the header.
 */
async function getSheetValues(spreadsheetId, range) {
    if (!sheets) throw new Error("Google API auth not initialized.");
    return withRetry(async () => {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range,
        });
        return res.data.values || [];
    });
}

/**
 * Helper to download ODS export file as stream
 */
async function getOdsExportStream(fileId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    return withRetry(async () => {
        const res = await drive.files.export({
            fileId: fileId,
            mimeType: 'application/x-vnd.oasis.opendocument.spreadsheet'
        }, { responseType: 'stream' });
        return res.data;
    });
}

/**
 * 1. Create or get today's date folder
 */
async function getOrCreateDateFolder(masterBackupFolderId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    const dateStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Check if the folder already exists
    const q = `'${masterBackupFolderId}' in parents and name='${dateStr}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    
    return withRetry(async () => {
        const listRes = await drive.files.list({ q, fields: 'files(id)' });
        
        if (listRes.data.files.length > 0) {
            return listRes.data.files[0].id; // Return existing folder ID
        }
        
        // Otherwise, create the new folder
        const createRes = await drive.files.create({
            requestBody: {
                name: dateStr,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [masterBackupFolderId]
            },
            fields: 'id'
        });
        
        console.log(`📁 Created new backup folder: ${dateStr}`);
        return createRes.data.id;
    });
}

/**
 * 2. Copy .ods files into the date folder
 */
async function backupSheetToDrive(originalFileId, originalFileName, dateFolderId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    return withRetry(async () => {
        await drive.files.copy({
            fileId: originalFileId,
            requestBody: {
                name: `${originalFileName}.ods`, // Keeps original name, adds extension
                parents: [dateFolderId] 
            }
        });
        console.log(`  📄 Copied: ${originalFileName}`);
    });
}

/**
 * 3. Upload nav.json into the date folder
 */
async function backupNavJsonToDrive(navTreeObject, dateFolderId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    return withRetry(async () => {
        const jsonString = JSON.stringify(navTreeObject, null, 2);
        const fileStream = Readable.from([jsonString]);

        await drive.files.create({
            requestBody: {
                name: `nav.json`,
                mimeType: 'application/json',
                parents: [dateFolderId]
            },
            media: {
                mimeType: 'application/json',
                body: fileStream // Uploads directly from server memory
            }
        });
        console.log("  📄 Uploaded: nav.json");
    });
}

module.exports = {
    getFolderContents,
    getSpreadsheetMetadata,
    getSheetValues,
    getOdsExportStream,
    getOrCreateDateFolder,
    backupSheetToDrive,
    backupNavJsonToDrive
};
