# Sheet Aggregator Rapor

A Node.js/Express microservice that aggregates report card data from Google Drive & Sheets into a local SQLite database and performs native backups of `.ods` files to a dedicated Google Drive folder. Replaces the previous n8n visual workflow.

---

## Prerequisites

- **Node.js** v18 or higher
- **npm** v8+
- A **Google Cloud** project with Drive & Sheets APIs enabled
- A **Google Drive Master Backup Folder** ID

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Google Service Account Setup

This app uses a **Google Service Account** (not OAuth) to access Google Drive and Google Sheets without user interaction.

### Steps:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and select or create a project.
2. Enable the following APIs:
   - **Google Drive API** — [Enable here](https://console.cloud.google.com/apis/library/drive.googleapis.com)
   - **Google Sheets API** — [Enable here](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
3. Navigate to **IAM & Admin → Service Accounts**.
4. Click **Create Service Account**, give it a name (e.g., `rapor-sync-bot`), then click **Done**.
5. Click on the created account → **Keys** tab → **Add Key → Create new key → JSON**.
6. Download the JSON file and save it as:
   ```
   google-service-account.json
   ```
   Place it in the **root of this project** (next to `index.js`).
  - Open the root folder and the **Master Backup Folder** on Google Drive.
  - Click **Share**, then paste the service account email (looks like `rapor-sync-bot@your-project.iam.gserviceaccount.com`).
  - Grant it **Editor** access (required for creating backup folders and copying files). Click **Send**.

> ⚠️ **Never commit `google-service-account.json` to Git.** It is already listed in `.gitignore`.

---

## 3. Environment Variables Setup

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

```dotenv
# Application
PORT=3000

# API Security — required in x-api-key header or ?api_key query parameter for all /api requests
API_SECRET_KEY=your_generated_secret_key_here

# Google Drive
# The ID of the root folder on Google Drive that contains all Tahun Ajaran subfolders.
# Example: https://drive.google.com/drive/folders/<THIS_IS_THE_ID>
ROOT_DRIVE_FOLDER=your_root_folder_id_here

# Google Drive Backup
# The ID of the master folder where daily backups will be stored.
BACKUP_DRIVE_FOLDER=your_master_backup_folder_id_here
```

Generate a strong `API_SECRET_KEY` with this one-liner:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### How to find your `ROOT_DRIVE_FOLDER` ID:

1. Open Google Drive in your browser.
2. Navigate to the root folder that contains the Tahun Ajaran subfolders.
3. Copy the ID from the URL:
   ```
   https://drive.google.com/drive/folders/1VFXen2Q4O9vRIMr--g6TTHvxrX1pNUIE
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                           This part is your folder ID
   ```

---

## 4. Run the Development Server

```bash
npm run dev
```

This starts the server with `nodemon` for automatic restarts on file changes.

### Verify it's running:

```bash
curl http://localhost:3000/api/rapor/status
```

---

## 5. Trigger a Manual Sync

Once credentials are configured, trigger a sync manually:

```bash
curl -X POST http://localhost:3000/api/rapor/sync
# Or via browser:
# http://localhost:3000/api/rapor/sync?api_key=YOUR_API_SECRET_KEY
```

Then monitor the sync progress:

```bash
curl http://localhost:3000/api/rapor/status
```

And retrieve the result:

```bash
curl http://localhost:3000/api/rapor/data
```

---

## Available Scripts

| Command | Description |
|---|---|
| `npm start` | Runs the production server using `node`. |
| `npm run dev` | Runs the development server with `nodemon` for auto-restarts. |

---

## Project Structure

```
sheet-aggregator-rapor/
├── .env                          # Environment variables (not tracked in Git)
├── .env.example                  # Template for environment variables
├── google-service-account.json   # Google IAM key (⚠️ Keep Secret! Not tracked in Git)
├── index.js                      # App entry point — starts Express + registers cron
├── cron.js                       # node-cron schedule (runs sync daily at 2:00 AM)
├── database.js                   # SQLite schema, logStep(), and saveNavTree() helpers
├── database.sqlite               # Auto-generated SQLite database file
├── routes/
│   └── api.js                    # Express router — /api/rapor/* endpoints
├── services/
│   └── syncService.js            # Main sync orchestration logic
├── integrations/
│   ├── googleApi.js              # Google Drive & Sheets API helpers (Includes Backups)
└── dev guide/                    # Internal documentation & planning
```

---

## Automated Schedule

The sync runs automatically at **2:00 AM daily** via `node-cron`. The schedule is defined in `cron.js`:

```js
cron.schedule('0 2 * * *', async () => {
    // triggers runSync()
});
```

To change the schedule, edit the cron expression in `cron.js`. Use [crontab.guru](https://crontab.guru/) to generate expressions.

---

## Licensing

MIT
