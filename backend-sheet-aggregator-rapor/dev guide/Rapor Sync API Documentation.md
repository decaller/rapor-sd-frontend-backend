# **Rapor Sync API (Node.js/Express)**

This application replaces the previous n8n visual workflow ("Update Sheet Rapor") with a fast, concurrent Node.js microservice. It handles fetching Google Drive hierarchies, extracting Google Sheets metadata, backing up .ods files to Google Drive, and generating a compiled JSON navigation tree for the frontend.

## **🏗️ Architecture Stack**

* **Framework:** Express.js (Lightweight API handling)  
* **Google API:** googleapis (Service Account authentication)  
* **Database/Logging:** SQLite \+ sqlite (In-memory/local state & debugging logs)  
* **File Transfer:** Google Drive API (Backups)  
* **Scheduling:** node-cron (Native nightly cron jobs)

## **🗺️ Logic Mapping (n8n \-\> Node.js)**

The API replicates and optimizes the n8n logic natively:

### **1\. File Traversal (Google Drive)**

* **n8n Nodes:** get TahunAjaran \-\> get Semester \-\> get Mapel & get Ekskul.  
* **Node Implementation:** Uses drive.files.list() sequentially with the root folder ID (1VFXen2Q4O9vRIMr--g6TTHvxrX1pNUIE).

### **2\. The "Mapel" (Subjects) Branch**

* **n8n Nodes:** Google Sheets (Reads SETUP gid=0), Filter (row \> 7, \< 13), Code (Subject mapping).  
* **Node Implementation:** googleapis fetches the sheet properties. A mapping object translates abbreviations (PAI, PP, MTK) into full subject names. The data is parsed into a hierarchical tree categorized by Ledger, Cetak Rapor, Cover, and Biodata.

### **3\. The "Ekskul" (Extracurriculars) Branch**

* **n8n Nodes:** Google Sheets1 (Reads SETUP), Filter1, Code1.  
* **Node Implementation:** Groups subclasses by grade level (Kelas 1, 2, 3...). Injects the required fixed GID (1676084899) to every node to ensure proper routing on the frontend.

### **4\. Backups & Output**

* **n8n Nodes:** FTP1/FTP2 \- Backup, FTP (nav.json upload).  
* **Node Implementation:** The process runs concurrently inside `syncService.js`. It copies .ods files directly within Google Drive to a designated backup folder. Finally, the generated nav.json tree is also saved to the backup folder on Google Drive and locally in SQLite.

## **📂 Project Structure**

rapor-sync-api/  
├── .env                          \# Environment variables (Ports, Folder IDs, Google IDs)  
├── package.json                  \# Dependencies & scripts  
├── google-service-account.json   \# Google IAM Key (Keep Secret\!)  
├── database.js                   \# SQLite schema and logging helpers  
├── server.js                     \# Main Express app, API endpoints, and cron jobs  
└── database.sqlite               \# Auto-generated database file

## **🚀 API Endpoints**

### **POST /api/rapor/sync**

**Description:** Manually triggers the background sync process.  
**Response:** 202 Accepted

* Clears previous logs in the SQLite database.  
* Spawns the background process. Does not wait for the sync to finish before responding to prevent HTTP timeouts.

### **GET /api/rapor/data**

**Description:** Retrieves the latest successfully compiled JSON tree.  
**Response:** 200 OK (Returns the nav\_tree from rapor\_data table).

* *Note: Replaces the need to fetch nav.json via HTTP/FTP on the frontend.*

### **GET /api/rapor/status**

**Description:** Fetches the live-updating sync logs for debugging.  
**Response:** 200 OK (Array of objects).

* **Fields:** step\_name, status (PENDING, SUCCESS, ERROR), message, timestamp.  
* *Note: Replaces the n8n visual execution map. Useful for frontend loading screens.*

## **⏱️ Automated Scheduling**

The app utilizes node-cron inside server.js to replace the n8n cron trigger.  
Currently configured to run at **2:00 AM daily**:  
cron.schedule('0 2 \* \* \*', async () \=\> {  
    // Logic here  
});

## **🛠️ Installation & Setup**

1. **Clone & Install:**  
   mkdir rapor-sync-api  
   cd rapor-sync-api  
   npm init \-y  
   npm install express googleapis cors dotenv sqlite3 sqlite node-cron  
   npm install \--save-dev nodemon

2. **Google Service Account:**  
   * Go to Google Cloud Console \> IAM & Admin \> Service Accounts.  
   * Create an account, generate a JSON key, and save it as google-service-account.json.  
   * **Important:** Go to your root Drive folder (1VFXen2Q4O9vRIMr--g6TTHvxrX1pNUIE) and share it with the service account email (e.g., sync-bot@project.iam.gserviceaccount.com).  
3. **Environment Setup (.env):**  
   PORT=3000  
   ROOT\_DRIVE\_FOLDER=1VFXen2Q4O9vRIMr--g6TTHvxrX1pNUIE  
   BACKUP\_DRIVE\_FOLDER=your\_master\_backup\_folder\_id\_here

4. **Run for Development:**  
   npm run dev

   *Tip: Use VS Code Logpoints instead of console.log for cleaner debugging\!*