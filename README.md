# Rapor

Monorepo for the Rapor application:

- `frontend-astro-rapor/`: Astro frontend for browsing report data.
- `backend-sheet-aggregator-rapor/`: Express service that reads Google Drive and Google Sheets, writes the compiled navigation tree to SQLite, and uploads backup files to the remote server.
- `docker-compose.yml`: production-style multi-container setup for frontend, backend, and Caddy.

This root README replaces the scattered project notes with one setup, operations, and deployment guide.

## Architecture

The stack has three runtime services:

- `backend`: Node.js + Express API, SQLite storage, Google Drive/Sheets integration, scheduled sync job.
- `frontend`: Astro site, powered by Alpine.js for interactive client-side state, providing both the main report viewer and a secure Admin Log Dashboard.
- `caddy`: reverse proxy and TLS terminator. Requests to `/api/*` go to the backend; everything else goes to the frontend.

High-level flow:

1. The backend traverses a configured Google Drive root folder.
2. It reads spreadsheet metadata from Drive/Sheets.
3. It compiles a `nav.json`-style tree and stores the latest version in SQLite.
4. It exposes API endpoints for manual sync, status polling, and data retrieval.
5. It uploads backup files (ODS files and `nav.json`) to the configured Google Drive backup folder.

## Repository Layout

```text
.
├── .env.example
├── Caddyfile
├── docker-compose.yml
├── README.md
├── backend-sheet-aggregator-rapor/
│   ├── Dockerfile
│   ├── README.md
│   ├── cron.js
│   ├── database.js
│   ├── index.js
│   ├── integrations/
│   ├── routes/
│   ├── services/
│   └── dev guide/
└── frontend-astro-rapor/
    ├── Dockerfile
    ├── README.md
    ├── public/
    └── src/
```

## Prerequisites

For local development without Docker:

- Node.js `22.x`
- npm

For containerized deployment:

- Docker Engine
- Docker Compose support
- Optional but recommended: Portainer for stack management

External dependencies:

- Google Cloud project with Google Drive API and Google Sheets API enabled
- Google service account JSON key
- Access to the target Google Drive root folder
- A Google Drive folder ID for storing daily backups
- Public DNS record for your production domain if using automatic TLS with Caddy

## Environment Variables

Copy the root example file:

```bash
cp .env.example .env
```

Current required variables:

```dotenv
DOMAIN=localhost
BACKEND_PORT=3000
API_SECRET_KEY=replace_with_a_strong_random_secret_key
ROOT_DRIVE_FOLDER=your_root_folder_id_here
GOOGLE_APPLICATION_CREDENTIALS=/app/google-service-account.json
BACKUP_DRIVE_FOLDER=your_master_backup_folder_id_here
```

Notes:

- `DOMAIN=localhost` keeps local development simple. In production this must be your real domain.
- `API_SECRET_KEY` is required for all `/api/*` routes via the `x-api-key` header or the `?api_key=` query parameter.
- `GOOGLE_APPLICATION_CREDENTIALS` points to the in-container path. The actual JSON file is bind-mounted from `backend-sheet-aggregator-rapor/google-service-account.json`.
- `ROOT_DRIVE_FOLDER` must be the folder ID, not the full Google Drive URL.

Generate a strong API secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Credential Setup

### Google Drive and Google Sheets Access

This project uses a Google service account, not an interactive OAuth login.

1. Open Google Cloud Console.
2. Create or select a project.
3. Enable `Google Drive API` and `Google Sheets API`.
4. Go to `IAM & Admin -> Service Accounts`.
5. Create a service account, for example `rapor-sync-bot`.
6. Open the service account and create a new JSON key.
7. Save the file as `backend-sheet-aggregator-rapor/google-service-account.json`.
8. Open the target Drive root folder in Google Drive and share it with the service account email using at least Viewer access.

To get the Drive folder ID:

```text
https://drive.google.com/drive/folders/1VFXen2Q4O9vRIMr--g6TTHvxrX1pNUIE
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       This part is ROOT_DRIVE_FOLDER
```

### Google Drive Backup Setup

The backend requires a `BACKUP_DRIVE_FOLDER` environment variable.

1. Create a new folder in Google Drive to act as the master backup location.
2. Share this folder with your service account email (from the step above) granting it **Editor** access so it can create daily subfolders and copy files.
3. Copy the master backup folder ID from its URL and use it as your `BACKUP_DRIVE_FOLDER`.

## Running Locally

### Option 1: Docker Compose

This matches production most closely.

1. Create `.env` from `.env.example`.
2. Place `google-service-account.json` at `backend-sheet-aggregator-rapor/google-service-account.json`.
3. Start the stack:

```bash
docker compose up --build
```

The services will be available through Caddy:

- frontend: `http://localhost`
- admin dashboard: `http://localhost/admin/logs`
- API through Caddy: `http://localhost/api/rapor/status`, `http://localhost/api/rapor/data`, `http://localhost/api/rapor/sync` (You can append `?api_key=YOUR_SECRET_KEY` for easy browser testing)

### Option 2: Run Frontend and Backend Separately

Backend:

```bash
cd backend-sheet-aggregator-rapor
cp .env.example .env
npm install
npm run dev
```

Frontend:

```bash
cd frontend-astro-rapor
npm install
npm run dev
```

Important:

- The backend standalone `.env.example` exists only for isolated backend development. The monorepo source of truth is the root `.env.example`.
- The frontend requires Node `>=22.12.0`.

## Admin Dashboard

An admin interface is available at `/admin/logs` (e.g., `http://localhost/admin/logs` when running via Compose, or `http://localhost:4321/admin/logs` directly). 
It features a live-updating dashboard built with Astro and Alpine.js. It securely polls the backend's `/api/rapor/status` endpoint via a frontend Astro proxy endpoint (`/api/proxy-logs`), successfully hiding the `API_SECRET_KEY` from the client. The dashboard also provides a button to trigger a force-sync via the background service.

## API Reference

All `/api/*` routes require the `x-api-key` header or `?api_key=` query parameter matching `API_SECRET_KEY`.

Use one of these base URLs depending on how you run the app:

- Docker Compose with Caddy: `http://localhost/api/rapor`
- Standalone backend process: `http://localhost:3000/api/rapor`

### `GET` or `POST /api/rapor/sync`

Starts a background sync job and returns `202 Accepted`. You can also just visit `http://localhost/api/rapor/sync?api_key=YOUR_SECRET_KEY` in your browser.

Example:

```bash
curl -X POST \
  -H "x-api-key: YOUR_API_SECRET_KEY" \
  http://localhost/api/rapor/sync
```

### `GET /api/rapor/status`

Returns sync log rows used for live progress reporting.

```bash
curl \
  -H "x-api-key: YOUR_API_SECRET_KEY" \
  http://localhost/api/rapor/status
```

### `GET /api/rapor/data`

Returns the latest compiled navigation tree from SQLite.

```bash
curl \
  -H "x-api-key: YOUR_API_SECRET_KEY" \
  http://localhost/api/rapor/data
```

Rate limiting:

- `GET/POST /sync`: 1 request per 5 minutes per IP
- `GET /status` and `GET /data`: 60 requests per minute per IP

## Data Structure Expectations

### Google Drive Layout

The sync logic expects a strict hierarchy under `ROOT_DRIVE_FOLDER`:

```text
[Root Rapor Folder]
└── 2026/2027
    ├── Semester 1
    │   ├── Nilai Ekstrakurikuler
    │   ├── Kelas 1
    │   │   ├── Nilai Mapel Kelas 1A
    │   │   ├── Nilai Mapel Kelas 1B
    │   ├── Kelas 2
    │   └── ...
    └── Semester 2
```

### Compiled Navigation Shape

The backend generates a tree consumed by the frontend. At the top level it looks like:

```json
{
  "title": "Rapor SD",
  "data": [
    {
      "tahunAjaran": "2025/2026",
      "semester": 1,
      "data": {
        "dataMapel": [],
        "dataEkskul": []
      }
    }
  ]
}
```

Implementation details carried over from the backend design docs:

- `dataMapel` groups subject sheets and helper groups like Rekapitulasi, Cetak Rapor, Cover, and Biodata.
- `dataEkskul` groups extracurricular data by class level and subclass.
- Several frontend-facing values are stored as stringified JSON payloads for compatibility with the existing UI.

## Implementation Guide

The backend is no longer an n8n workflow; it is an Express service with SQLite state and scheduled sync execution.

Current implementation model:

1. `index.js` loads environment variables, initializes SQLite, registers cron jobs, and starts Express.
2. `routes/api.js` exposes sync, status, and data endpoints with API-key protection and rate limiting.
3. `services/syncService.js` performs the Drive traversal and output construction, and handles backing up data to Google Drive.
4. `integrations/googleApi.js` handles Drive and Sheets calls, including file copying for backups, using the service account key.
5. `cron.js` schedules the nightly sync.

Areas to pay attention to when extending the backend:

- Subject-name mapping is driven by spreadsheet/tab naming rules and may need expansion as naming conventions evolve.
- Extracurricular row mapping depends on the source sheet structure; keep the parser aligned with the real SETUP sheet format.
- The frontend expects the backend payload shape to stay stable, including the stringified value objects.
- Health and deployment behavior assume the backend root path `/` remains available for container healthchecks.

## Manual Verification Checklist

Use this after setup or deployment:

1. Confirm `docker compose up --build` or the equivalent Portainer stack starts all three services.
2. Open the frontend and verify the page loads through Caddy.
3. Call `GET /api/rapor/status` with the correct `x-api-key` or `?api_key=` param.
4. Trigger `GET or POST /api/rapor/sync`.
5. Watch `/api/rapor/status` until the job completes or fails.
6. Call `GET /api/rapor/data` and verify the payload matches the expected school year and semester structure.
7. Confirm the SQLite database persists after a container restart.
8. Confirm backup files (ODS and nav.json) are successfully copied to daily subfolders within your Google Drive backup folder.

## Deployment With Portainer

Use the existing root [`docker-compose.yml`](/home/abuhafi/Project/rapor/docker-compose.yml) as the deployment source. That is the correct file for this repo because it already defines:

- build contexts for the frontend and backend
- the Caddy reverse proxy
- the persistent SQLite volume
- the mounted Google service account JSON file

### Important Constraint

This compose file uses:

- `build:` with local source directories
- a bind mount for `backend-sheet-aggregator-rapor/google-service-account.json`
- a bind mount for the root [`Caddyfile`](/home/abuhafi/Project/rapor/Caddyfile)

That means Portainer must deploy from a Docker host that has the full repository contents available. A copy-pasted stack in isolation is not enough unless you first convert the compose file to use pre-built images and absolute host paths.

### Recommended Portainer Workflow

1. Clone this repository onto the Docker host, for example into `/opt/rapor`.
2. On the server, create `/opt/rapor/.env` from `.env.example`.
3. Place the Google credentials file at `/opt/rapor/backend-sheet-aggregator-rapor/google-service-account.json`.
4. Ensure your DNS record already points the chosen domain to the server.
5. In Portainer, create a new stack that uses the repository copy of `/opt/rapor/docker-compose.yml`.
6. Set the stack environment values to match the `.env` file if your Portainer workflow manages them there instead.
7. Deploy the stack.
8. Check that `backend`, `frontend`, and `caddy` all become healthy.
9. Open `https://your-domain` and verify both the frontend and `/api/*` routing.

### Portainer Notes

- If your Portainer installation cannot build images from this repository layout, build and push the frontend/backend images first, then replace `build:` with `image:` entries.
- If bind mounts with relative paths do not work in your Portainer setup, switch them to absolute host paths.
- Automatic HTTPS only works when `DOMAIN` is a real public domain resolving to the server and ports `80` and `443` are reachable.

## Operational Notes

- Backend data is stored in the named Docker volume `backend_data`.
- Caddy state is stored in `caddy_data` and `caddy_config`.
- The backend cron job is initialized at startup and is currently intended to run daily at 2:00 AM.
- The backend root path `/` returns a simple string and is used by the container healthcheck.

## Existing Source Documents

The material in this README was consolidated from:

- [`backend-sheet-aggregator-rapor/README.md`](/home/abuhafi/Project/rapor/backend-sheet-aggregator-rapor/README.md)
- [`frontend-astro-rapor/README.md`](/home/abuhafi/Project/rapor/frontend-astro-rapor/README.md)
- [`backend-sheet-aggregator-rapor/dev guide/Rapor Sync API Documentation.md`](/home/abuhafi/Project/rapor/backend-sheet-aggregator-rapor/dev guide/Rapor Sync API Documentation.md)
- [`backend-sheet-aggregator-rapor/dev guide/Data Structure Guide.md`](/home/abuhafi/Project/rapor/backend-sheet-aggregator-rapor/dev guide/Data Structure Guide.md)
- [`backend-sheet-aggregator-rapor/dev guide/Navigation JSON Structure.md`](/home/abuhafi/Project/rapor/backend-sheet-aggregator-rapor/dev guide/Navigation JSON Structure.md)
- [`backend-sheet-aggregator-rapor/dev guide/Plan Checklist.md`](/home/abuhafi/Project/rapor/backend-sheet-aggregator-rapor/dev guide/Plan Checklist.md)

I left the original markdown files in place. Remove them only if you want the root README to become the single source of truth.
