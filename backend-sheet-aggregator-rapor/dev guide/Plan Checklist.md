# 📋 Rapor Sync API - Implementation Checklist

This checklist outlines the steps required to fully implement the Rapor Sync API based on the internal guide documents.

---

## 1. 🏗️ Setup & Core Configuration
- [x] Initialize Node.js project & install dependencies (`express`, `googleapis`, `sqlite3`, `sqlite`, `node-cron`, `cors`, `dotenv`).
- [x] Create basic Express server with `/api/rapor/*` routes wired up.
- [x] Setup `database.js` to initialize SQLite tables (`rapor_data` for JSON payload, `sync_logs` for status).
- [ ] Place `google-service-account.json` in the project root (generated from Google Cloud Console — see README).
- [ ] Populate `.env` with all required variables: `PORT`, `ROOT_DRIVE_FOLDER`, `BACKUP_DRIVE_FOLDER`.
- [x] Update `.env.example` to document all required variables (currently only shows `PORT`).
- [ ] Verify `.gitignore` covers both `.env` and `google-service-account.json`.

---

## 2. 🗂️ Google Drive Traversal Logic
- [x] Implement `googleApi.js` with Service Account auth using `googleapis`.
- [x] `getFolderContents(folderId)` — lists all files and subfolders in a given Drive folder.
- [x] Traverse root folder → Tahun Ajaran → Semester in `syncService.js`.
- [x] Identify items by name (`Ekskul`/`Ekstrakurikuler`) or by mimeType (folder = Mapel class).

---

## 3. 📊 Google Sheets Metadata Extraction
- [x] Implement `getSpreadsheetMetadata(spreadsheetId)` — returns sheet tab names and GIDs.
- [x] **Mapel Branch**: Basic structure built — groups sheets by Rekapitulasi, Cetak Rapor, Cover, and subjects.
  - [x] **Expand abbreviation map** — Full mapping: PAI, PP, BI, MTK, IPAS, PJOK, SBY, BSU, BING, TIK, BAR, FQH, HDS.
  - [x] Handle `Biodata` sheet grouping.
- [x] **Ekskul Branch Logic** (✅ IMPLEMENTED):
  - Scans column A of Level tab and Nilai tab independently to find subclass starting rows.
  - If both Level AND Nilai tabs exist → all subclasses get `valueLevel` + `valueNilai` (per-file decision).
  - If only Level tab exists → all subclasses get simple `value`.
  - Subclasses are auto-discovered and grouped by grade (Kelas 1, 2, …) dynamically.

---

## 4. 🗃️ Output Construction (nav.json)
- [x] Build the final nested JSON tree (`finalJson`) from traversal results.
- [x] Stringified JSON values for `value`, `valueLevel`, `valueNilai` keys are correctly applied.
- [ ] Validate final output shape against `Navigation JSON Structure.md` end-to-end with real data.

---

## 5. 💾 Database & State Management
- [x] `logStep(stepName, status, message)` — logs each sync step with timestamp.
- [x] `saveNavTree(json)` — upserts the final JSON into `rapor_data`.
- [ ] Confirm that old `rapor_data` rows are cleared or replaced (not stacking up) before each sync.

---

## 6. 🌐 API Endpoints
- [x] `POST /api/rapor/sync`: Clears previous logs, spawns `runSync()` asynchronously, returns 202.
- [x] `GET /api/rapor/data`: Returns latest `nav_tree` from `rapor_data`.
- [x] `GET /api/rapor/status`: Returns all rows from `sync_logs` for live-status checking.

---

## 7. 📤 Backup Routine (Google Drive)
- [x] `backupService.js` logic implemented within `googleApi.js` and `syncService.js`.
- [x] `getOdsExportStream(fileId)` — implemented in `googleApi.js`.
- [x] **Wire up ODS upload inside sync loop** — Done, files are copied to the daily backup folder.
- [x] Confirm backup folder ID (`BACKUP_DRIVE_FOLDER`) is set in `.env`.
- [x] Define correct hierarchy for daily backups (e.g., `YYYY-MM-DD/filename.ods`).

---

## 8. ⏱️ Automated Scheduling
- [x] `cron.js` — `node-cron` job created to trigger sync at 2:00 AM daily.
- [ ] **Verify `cron.js` is loaded at startup** — confirm it is `require()`'d inside `index.js`.

---

## 9. ⚙️ Environment & Credentials Setup
- [ ] Follow README guide to create Google Cloud Service Account and download JSON key.
- [ ] Share the root Drive folder (`ROOT_DRIVE_FOLDER` ID) with the service account email.
- [ ] Confirm FTP host, username, and password work by testing a manual connection before running sync.

---

## 10. 🧪 Testing & Validation
- [ ] Manually trigger `POST /api/rapor/sync` with real credentials and verify sync logs via `GET /api/rapor/status`.
- [ ] Inspect `GET /api/rapor/data` output and validate against `Navigation JSON Structure.md`.
- [ ] Test FTP backup flow — confirm `.ods` files appear on the remote server.
- [ ] Add error handling/fallback for missing or malformed SETUP sheet in Ekskul files.
- [ ] Load test: run sync against full real Drive folder to catch rate-limit or timeout issues.

---

## 11. 🚀 Deployment
- [ ] Document production startup instructions (e.g., using `pm2 start index.js`).
- [ ] Consider `pm2` or systemd service for automatic restarts and uptime management.
- [ ] Configure log rotation for `sync_logs` to prevent unbounded database growth.
- [ ] Set up monitoring/alerting for sync failures (e.g., check `sync_logs` for ERROR status).
