const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

// Path to your service account key file
const KEYFILEPATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../google-service-account.json');

// Check if credentials exist
let auth = null;
if (fs.existsSync(KEYFILEPATH)) {
    auth = new google.auth.GoogleAuth({
        keyFile: KEYFILEPATH,
        scopes: [
            'https://www.googleapis.com/auth/drive', // Full access for folder creation and copying
            'https://www.googleapis.com/auth/spreadsheets.readonly'
        ],
    });
} else {
    console.warn("⚠️ Warning: google-service-account.json not found! Google APIs will not work.");
}

const drive = auth ? google.drive({ version: 'v3', auth }) : null;
const sheets = auth ? google.sheets({ version: 'v4', auth }) : null;

/**
 * Lists contents of a specific folder
 */
async function getFolderContents(folderId) {
    if (!drive) throw new Error("Google API auth not initialized. Please configure google-service-account.json");
    const res = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 1000,
    });
    return res.data.files;
}

/**
 * Fetches basic metadata for a spreadsheet (e.g. tab names and IDs)
 */
async function getSpreadsheetMetadata(spreadsheetId) {
    if (!sheets) throw new Error("Google API auth not initialized.");
    const res = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties'
    });
    return res.data.sheets.map(sheet => sheet.properties);
}

/**
 * Reads raw cell values from a given range or sheet name.
 * Returns a 2D array (rows x cols). First row is typically the header.
 */
async function getSheetValues(spreadsheetId, range) {
    if (!sheets) throw new Error("Google API auth not initialized.");
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });
    return res.data.values || [];
}

/**
 * Helper to download ODS export file as stream
 */
async function getOdsExportStream(fileId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    const res = await drive.files.export({
        fileId: fileId,
        mimeType: 'application/x-vnd.oasis.opendocument.spreadsheet'
    }, { responseType: 'stream' });
    return res.data;
}

/**
 * 1. Create or get today's date folder
 */
async function getOrCreateDateFolder(masterBackupFolderId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    const dateStr = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    
    // Check if the folder already exists
    const q = `'${masterBackupFolderId}' in parents and name='${dateStr}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
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
}

/**
 * 2. Copy .ods files into the date folder
 */
async function backupSheetToDrive(originalFileId, originalFileName, dateFolderId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    try {
        await drive.files.copy({
            fileId: originalFileId,
            requestBody: {
                name: `${originalFileName}.ods`, // Keeps original name, adds extension
                parents: [dateFolderId] 
            }
        });
        console.log(`  📄 Copied: ${originalFileName}`);
    } catch (error) {
        console.error(`  ❌ Failed to copy ${originalFileName}:`, error.message);
    }
}

/**
 * 3. Upload nav.json into the date folder
 */
async function backupNavJsonToDrive(navTreeObject, dateFolderId) {
    if (!drive) throw new Error("Google API auth not initialized.");
    try {
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
    } catch (error) {
        console.error("  ❌ Failed to upload nav.json:", error.message);
    }
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
