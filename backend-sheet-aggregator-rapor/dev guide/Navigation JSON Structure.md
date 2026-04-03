# **Navigation JSON Structure (nav.json)**

This document outlines the final compiled JSON structure that the Rapor Sync API will generate. This payload is consumed by the frontend to build the interactive sidebar/navigation tree.  
The final JSON is an object containing metadata (like title and academic year/semester) that wraps the two primary arrays: dataMapel (Subjects) and dataEkskul (Extracurriculars).  
*Note: The value, valueLevel, and valueNilai fields contain stringified JSON objects. This is maintained for compatibility with the frontend UI components that expect stringified payloads in their attributes.*

## **🌳 Root Structure**

{  
  "title": "Rapor SD",  
  "data": \[  
    {  
      "tahunAjaran": "2025/2026",  
      "semester": 1,  
      "data": {  
        "dataMapel": \[  
          // Array of Class Nodes for Subjects  
        \],  
        "dataEkskul": \[  
          // Array of Grade Level Nodes for Extracurriculars  
        \]  
      }  
    }  
  \]  
}

## **📘 1\. dataMapel (Subject Hierarchy)**

The dataMapel array groups everything by individual subclass (e.g., "Kelas 1A"). Inside each subclass, it lists the individual subjects, followed by sub-folders for Rekapitulasi, Cetak Rapor, Cover, and Biodata.

### **Example Node:**

{  
  "label": "Kelas 1A",  
  "children": \[  
    // 1\. Individual Subjects (Flat)  
    {  
      "label": "Pendidikan Agama Islam",  
      "value": "{\\"gsheetId\\":\\"1abcXYZ...\\",\\"gid\\":123456789}"  
    },  
    {  
      "label": "Matematika",  
      "value": "{\\"gsheetId\\":\\"1abcXYZ...\\",\\"gid\\":987654321}"  
    },  
      
    // 2\. Rekapitulasi (Nested)  
    {  
      "label": "Rekapitulasi",  
      "children": \[  
        {  
          "label": "Ledger PTS",  
          "value": "{\\"gsheetId\\":\\"1abcXYZ...\\",\\"gid\\":111222333}"  
        }  
      \]  
    },  
      
    // 3\. Cetak Rapor (Nested)  
    {  
      "label": "Cetak Rapor",  
      "children": \[  
        {  
          "label": "cetak pts",  
          "value": "{\\"gsheetId\\":\\"1abcXYZ...\\",\\"gid\\":444555666}"  
        }  
      \]  
    },  
      
    // 4\. Cover & Biodata (Nested)  
    {  
      "label": "Cover",  
      "children": \[  
        {  
          "label": "cover depan",  
          "value": "{\\"gsheetId\\":\\"1abcXYZ...\\",\\"gid\\":777888999}"  
        }  
      \]  
    }  
  \]  
}

## **⚽ 2\. dataEkskul (Extracurricular Hierarchy)**

The dataEkskul array groups everything by Grade Level (e.g., "Kelas 1"). Inside each grade level, it lists the specific subclasses (1A, 1B, 1C).  
Every parent node here includes a **fixed GID** (1676084899), and the lowest-level child nodes split the coordinates into valueLevel and valueNilai with specific row ranges mapped from the SETUP sheet.

### **Example Node:**

{  
  "label": "Kelas 1",  
  "value": "{\\"gsheetId\\":\\"1lxz95ndodQoeMpER\_HRB25vshXrmtpFGWgYSlj\_qizc\\",\\"gid\\":1676084899}",  
  "children": \[  
    {  
      "label": "1A",  
      "valueLevel": "{\\"gsheetId\\":\\"1lxz95ndodQoeMpER\_HRB25vshXrmtpFGWgYSlj\_qizc\\",\\"gid\\":1676084899,\\"range\\":\\"A4\\"}",  
      "valueNilai": "{\\"gsheetId\\":\\"1lxz95ndodQoeMpER\_HRB25vshXrmtpFGWgYSlj\_qizc\\",\\"gid\\":1676084899,\\"range\\":\\"A4\\"}"  
    },  
    {  
      "label": "1B",  
      "valueLevel": "{\\"gsheetId\\":\\"1lxz95ndodQoeMpER\_HRB25vshXrmtpFGWgYSlj\_qizc\\",\\"gid\\":1676084899,\\"range\\":\\"A32\\"}",  
      "valueNilai": "{\\"gsheetId\\":\\"1lxz95ndodQoeMpER\_HRB25vshXrmtpFGWgYSlj\_qizc\\",\\"gid\\":1676084899,\\"range\\":\\"A32\\"}"  
    },  
    {  
      "label": "1C",  
      "valueLevel": "{\\"gsheetId\\":\\"1lxz95ndodQoeMpER\_HRB25vshXrmtpFGWgYSlj\_qizc\\",\\"gid\\":1676084899,\\"range\\":\\"A59\\"}",  
      "valueNilai": "{\\"gsheetId\\":\\"1lxz95ndodQoeMpER\_HRB25vshXrmtpFGWgYSlj\_qizc\\",\\"gid\\":1676084899,\\"range\\":\\"A59\\"}"  
    }  
  \]  
}

## **🔑 Data Dictionary**

* **title**: The overarching title of the application or portal (e.g., "Rapor SD").  
* **tahunAjaran**: The academic year of the corresponding dataset (e.g., "2025/2026").  
* **semester**: The numeric semester of the dataset (e.g., 1 or 2).  
* **label**: The display name shown in the UI (e.g., "Matematika", "Kelas 1A"). For subjects, it is automatically converted from abbreviations.  
* **children**: An array of nested child nodes. If a node has children, it acts as a folder/dropdown in the UI.  
* **value**: A **stringified JSON object** containing the exact coordinates to fetch the sheet data. Used primarily for standard subjects (dataMapel) and the root folders of Extracurriculars.  
* **valueLevel**: *(Ekskul sub-classes only)* A stringified JSON object containing the coordinates specifically for the student's extracurricular **Level/Predikat**.  
* **valueNilai**: *(Ekskul sub-classes only)* A stringified JSON object containing the coordinates specifically for the student's extracurricular **Nilai/Score**.

Inside these stringified JSON objects, you will find:

* gsheetId: The main alphanumeric ID of the Google Sheet file.  
* gid: The specific ID of the tab within the Google Sheet.  
* range: *(Ekskul only)* The specific cell coordinate to start reading from.