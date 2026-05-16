# SimplifIQ — Lead Automation Assessment

Automated lead intake prototype: capture a prospect's details, scrape their website, generate a personalized AI business audit, deliver a PDF by email, and archive the report locally.

## Features

- Lead capture form with validation
- Website enrichment (title, meta, headings, about text)
- Gemini-powered personalized audit (6 sections)
- Professional PDF report saved to `/reports`
- Automated email delivery with PDF attachment
- Graceful fallbacks when scrape or AI fails

## Tech Stack

- Node.js, Express
- Axios + Cheerio (scraping)
- Google Gemini API (`@google/generative-ai`)
- PDFKit (PDF)
- Nodemailer (Gmail SMTP)

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in `GEMINI_API_KEY`, `EMAIL_USER`, and `EMAIL_PASS`.

3. **Run the server**
   ```bash
   npm run dev
   ```

4. **Open the app**  
   http://localhost:3000

5. **Verify health**  
   http://localhost:3000/api/health → `"pipelineVersion": "phase7-complete-v1"`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default `3000`) |
| `GEMINI_API_KEY` | Yes* | Google AI Studio API key |
| `GEMINI_MODEL` | No | Model name (default `gemini-2.0-flash-lite`) |
| `EMAIL_USER` | Yes* | Gmail address for sending |
| `EMAIL_PASS` | Yes* | Gmail [App Password](https://myaccount.google.com/apppasswords) |
| `DEBUG_PIPELINE` | No | `true` for extra `[DEBUG]` logs |

\* AI and email have fallbacks for scrape/report, but full workflow needs both configured.

## API

### `GET /api/health`
Service status and module configuration.

### `POST /api/leads`
Body:
```json
{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "companyName": "Acme Inc",
  "companyWebsite": "https://acme.com"
}
```

Response includes `workflow.status`:
- `complete` — scrape OK, PDF + email succeeded
- `partial` — scrape degraded, PDF + email succeeded
- `email_failed` — PDF OK, email failed
- `pdf_failed` — PDF generation failed

## Project Structure

```
server.js          Express app + routes
pipeline.js        End-to-end orchestration
scraper.js         Website enrichment
aiReport.js        Gemini audit generation
pdfGenerator.js    PDF creation
emailSender.js     Email + attachment
public/            Lead capture UI
reports/           Generated PDFs (gitignored)
```

## Assumptions & Limitations

- Scraping uses static HTML only (no guaranteed support for JS-heavy SPAs).
- AI quality depends on scrape success and Gemini availability/quota.
- Gmail SMTP has send limits; use an app password with 2FA enabled.
- Reports are stored locally; not a production CRM replacement.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run server |
| `npm run dev` | Run with file watch |

## Bonus — Google Sheets & Drive (Phase 9)

When configured, each lead is:
1. **Appended to a Google Sheet** (name, email, company, website, timestamp, status, request ID)
2. **PDF archived** to a shared Google Drive folder

### Setup

1. Create a **service account** in Google Cloud and download the JSON key to `credentials/` (gitignored).
2. Enable **Google Sheets API** and **Google Drive API** in [Google Cloud Console](https://console.cloud.google.com/apis/library) for your project.
3. Share your **Google Sheet** with the service account email (Editor).
4. **Drive upload (important):** Service accounts have **no personal storage quota**. You must either:
   - **Recommended:** Create a folder inside a **[Shared Drive](https://support.google.com/a/answer/7212025)** (Google Workspace), share that folder with the service account as **Editor**, and use its folder ID as `GOOGLE_DRIVE_FOLDER_ID`.
   - **Or:** Share a folder in **your** My Drive with the service account as **Editor** (works for many setups; the file uses your quota, not the SA's).
   - **Or (Workspace):** Enable [domain-wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority) and set `GOOGLE_IMPERSONATE_USER=you@company.com` so uploads run as that user.
5. Add to `.env`:
   ```env
   GOOGLE_SHEET_ID=...
   GOOGLE_DRIVE_FOLDER_ID=...
   GOOGLE_APPLICATION_CREDENTIALS=./credentials/your-key.json
   # Optional Workspace delegation:
   # GOOGLE_IMPERSONATE_USER=you@company.com
   ```
6. Add header row to Sheet1 (row 1):  
   `Name | Email | Company | Website | Timestamp | Report Status | Request ID`

The app uses the full `drive` scope (not `drive.file`) so it can write into folders shared with the service account. It auto-detects the first `.json` in `credentials/` if the env path is wrong.
