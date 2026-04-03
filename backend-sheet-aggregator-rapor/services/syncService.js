const { logStep, saveNavTree } = require('../database');
const { 
    getFolderContents, 
    getSpreadsheetMetadata, 
    getOrCreateDateFolder, 
    backupSheetToDrive, 
    backupNavJsonToDrive 
} = require('../integrations/googleApi');

/**
 * The main orchestration function that pulls files from Google Drive,
 * parses the spreadsheet metadata, builds the nav tree, and uploads ODS files to FTP.
 */
async function runSync() {
    try {
        await logStep('SYNC_START', 'PENDING', 'Started the synchronization process.');

        const rootFolderId = process.env.ROOT_DRIVE_FOLDER;
        if (!rootFolderId) throw new Error("ROOT_DRIVE_FOLDER is not set in .env");

        await logStep('DRIVE_TRAVERSAL', 'PENDING', 'Traversing Google Drive folders...');
        
        // 1. Fetch Tahun Ajaran folders
        const tahunAjaranFolders = await getFolderContents(rootFolderId);
        const finalData = [];
        const processedSheets = []; // To track all spreadsheets for backup

        for (const ta of tahunAjaranFolders) {
            // Check if it's a folder (mimeType google.apps.folder)
            if (ta.mimeType !== 'application/vnd.google-apps.folder') continue;

            const semesterFolders = await getFolderContents(ta.id);
            for (const sem of semesterFolders) {
                if (sem.mimeType !== 'application/vnd.google-apps.folder') continue;
                
                // Parse semester number (e.g. "Semester 1" -> 1)
                const semMatch = sem.name.match(/\d+/);
                const semesterNum = semMatch ? parseInt(semMatch[0], 10) : 1;

                const semesterData = {
                    tahunAjaran: ta.name,
                    semester: semesterNum,
                    data: {
                        dataMapel: [],
                        dataEkskul: []
                    }
                };

                // Traverse inside Semester folder to get Ekskul and Mapel classes
                const classFilesAndFolders = await getFolderContents(sem.id);
                
                for (const item of classFilesAndFolders) {
                    if (item.name.includes('Ekskul') || item.name.includes('Ekstrakurikuler')) {
                        // Handle Ekskul Spreadsheets
                        await logStep('PROCESS_EKSKUL', 'PENDING', `Processing Ekskul for ${ta.name} Sem ${semesterNum}`);
                        
                        processedSheets.push({ id: item.id, name: item.name });
                        
                        // Data Ekskul Logic (Scaffolding dynamic row range from SETUP sheet)
                        // Fixed GID is required for backend routing (1676084899)
                        const ekskulNode = {
                            label: "Kelas 1", // Assuming root grouping
                            value: JSON.stringify({ gsheetId: item.id, gid: 1676084899 }),
                            children: [
                                {
                                    label: "1A",
                                    valueLevel: JSON.stringify({ gsheetId: item.id, gid: 1676084899, range: "A4" }),
                                    valueNilai: JSON.stringify({ gsheetId: item.id, gid: 1676084899, range: "A4" })
                                },
                                {
                                    label: "1B",
                                    valueLevel: JSON.stringify({ gsheetId: item.id, gid: 1676084899, range: "A32" }),
                                    valueNilai: JSON.stringify({ gsheetId: item.id, gid: 1676084899, range: "A32" })
                                }
                            ]
                        };
                        semesterData.data.dataEkskul.push(ekskulNode);
                        
                    } else if (item.mimeType === 'application/vnd.google-apps.folder') {
                        // Handle Mapel Folders (e.g., "Kelas 1", "Kelas 2") 
                        await logStep('PROCESS_MAPEL', 'PENDING', `Processing Mapel for ${item.name}`);

                        const mapelFiles = await getFolderContents(item.id);
                        
                        const kelasNode = {
                            label: item.name, // e.g. "Kelas 1A"
                            children: []
                        };

                        const rekapChildren = [];
                        const cetakChildren = [];
                        const coverChildren = [];
                        
                        for (const childFile of mapelFiles) {
                            if (childFile.mimeType !== 'application/vnd.google-apps.spreadsheet') continue;
                            
                            processedSheets.push({ id: childFile.id, name: childFile.name });
                            
                            // Mapel Branch Logic: Fetching sheets properties
                            const sheetsData = await getSpreadsheetMetadata(childFile.id);
                            
                            for (const sheet of sheetsData) {
                                const sheetName = sheet.title;
                                const gid = sheet.sheetId;
                                const valueObj = JSON.stringify({ gsheetId: childFile.id, gid: gid });
                                const lowerName = sheetName.toLowerCase();
                                
                                if (lowerName.includes('rekap') || lowerName.includes('ledger')) {
                                    rekapChildren.push({ label: sheetName, value: valueObj });
                                } else if (lowerName.includes('cetak')) {
                                    cetakChildren.push({ label: sheetName, value: valueObj });
                                } else if (lowerName.includes('cover') || lowerName.includes('bio')) {
                                    coverChildren.push({ label: sheetName, value: valueObj });
                                } else if (lowerName !== 'setup') {
                                    // Expand standard abbreviations mapping
                                    let expandedName = sheetName;
                                    if (lowerName === 'pai') expandedName = 'Pendidikan Agama Islam';
                                    if (lowerName === 'pp') expandedName = 'Pendidikan Pancasila';
                                    if (lowerName === 'mtk') expandedName = 'Matematika';
                                    
                                    kelasNode.children.push({ label: expandedName, value: valueObj });
                                }
                            }
                        }

                        if (rekapChildren.length > 0) kelasNode.children.push({ label: "Rekapitulasi", children: rekapChildren });
                        if (cetakChildren.length > 0) kelasNode.children.push({ label: "Cetak Rapor", children: cetakChildren });
                        if (coverChildren.length > 0) kelasNode.children.push({ label: "Cover", children: coverChildren });

                        semesterData.data.dataMapel.push(kelasNode);
                    }
                }

                finalData.push(semesterData);
            }
        }

        const finalJson = {
            title: "Rapor SD",
            data: finalData
        };
        
        await logStep('DB_SAVE', 'PENDING', 'Saving final JSON navigation tree to database.');
        await saveNavTree(finalJson);
        
        // --- BACKUP PROCESS ---
        try {
            const backupFolderId = process.env.BACKUP_DRIVE_FOLDER;
            if (backupFolderId) {
                await logStep('BACKUP_START', 'PENDING', 'Starting Google Drive backup...');
                
                // 1. Get or create today's backup folder
                const dateFolderId = await getOrCreateDateFolder(backupFolderId);
                
                // 2. Backup all processed sheets concurrently
                console.log(`📦 Copying ${processedSheets.length} sheets to backup folder...`);
                const copyPromises = processedSheets.map(sheet => 
                    backupSheetToDrive(sheet.id, sheet.name, dateFolderId)
                );
                await Promise.all(copyPromises);

                // 3. Backup the final nav.json
                await backupNavJsonToDrive(finalJson, dateFolderId);
                
                await logStep('BACKUP_COMPLETE', 'SUCCESS', 'Backup to Google Drive finished successfully.');
            } else {
                console.warn("⚠️ BACKUP_DRIVE_FOLDER not set. Skipping backup.");
            }
        } catch (backupError) {
            console.error("❌ Backup process failed:", backupError);
            await logStep('BACKUP_ERROR', 'ERROR', backupError.message);
        }
        
        await logStep('SYNC_COMPLETE', 'SUCCESS', 'Synchronization finished successfully.');

    } catch (error) {
        console.error("Sync process failed:", error);
        await logStep('SYNC_ERROR', 'ERROR', error.message);
    }
}

module.exports = { runSync };
