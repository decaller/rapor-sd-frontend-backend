# **Google Drive & Sheets Data Structure**

This document outlines the expected folder hierarchy in Google Drive and the internal data structure of the Google Sheets required for the Rapor Sync API to function correctly.

## **🗂️ Google Drive Folder Hierarchy**

The API expects a strict nested folder structure. The sync process begins at a predefined root folder and traverses down by Academic Year (Tahun Ajaran) and Semester.  
📁 \[Root Rapor Folder\] (Configured via ROOT\_DRIVE\_FOLDER ID)  
└── 📁 2026/2027 (Tahun Ajaran)  
    ├── 📁 Semester 1  
    │   ├── 📊 Nilai Ekstrakurikuler (Google Sheet File)  
    │   ├── 📁 Kelas 1  
    │   │   ├── 📊 Nilai Mapel Kelas 1A (Google Sheet File)  
    │   │   ├── 📊 Nilai Mapel Kelas 1B (Google Sheet File)  
    │   │   └── 📊 Nilai Mapel Kelas 1X ...  
    │   ├── 📁 Kelas 2  
    │   │   ├── 📊 Nilai Mapel Kelas 2A ...  
    │   └── 📁 Kelas X ...  
    └── 📁 Semester 2  
        └── ...

## **📊 Google Sheets Internal Structures**

Once the API traverses the folders and locates the files, it extracts specific metadata and ranges depending on the type of file.

### **1\. Nilai Ekstrakurikuler (Extracurricular Grades)**

This single file contains the extracurricular data for all subclasses. The API needs to map specific sub-classes to their exact starting rows within specific tabs (sheets).  
**Target Data Required:**  
For every subclass (1A, 1B, 2A, etc.), the API must extract the sheetId (GID) and the starting cell range.

* **Sheet Tab 1: "Nilai"**  
  * Extract the sheetId for the "Nilai" tab.  
  * Map subclass to starting cell (e.g., 1A \-\> A2, 1B \-\> A30).  
* **Sheet Tab 2: "Level"**  
  * Extract the sheetId for the "Level" tab.  
  * Map subclass to starting cell (e.g., 1A \-\> A2, 1B \-\> A30).

*Implementation Note:* Based on the legacy n8n setup, this mapping (e.g., knowing that 1B starts at row 30\) is typically defined in a SETUP sheet or config array where BarisKe (Row Number) dictates the cell range (e.g., 'A' \+ subClass.BarisKe).

### **2\. Nilai Mapel Kelas XX (Subject Grades)**

These files are separated per subclass (e.g., one file strictly for Kelas 1A). The API does not need specific cell ranges here; instead, it needs the metadata of all tabs (sheets) inside the file to build the navigation tree.  
**Target Data Required:**  
For the entire file, the API must fetch the list of all sheets and extract:

* sheetName (e.g., "PAI", "PP", "MTK", "Rekap...", "Cetak...")  
* sheetId (The unique GID for that specific tab)

**Processing Logic:**  
The extracted sheetName will be used to map abbreviations to full subject names (e.g., "PAI" \-\> "Pendidikan Agama Islam") and categorize other sheets into distinct navigation groups (Ledger, Cetak Rapor, Cover, Biodata) within the final JSON tree.