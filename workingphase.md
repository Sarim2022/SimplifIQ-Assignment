# SimplifIQ Assessment — Working Phase Tracker

> **Last updated:** Phase 9 — Google Sheets & Drive bonus complete  
> **Status:** Full assessment + bonus (scrape → AI → PDF → email → Sheets → Drive)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser (public/)                              │
│  index.html + style.css + script.js                                    │
│  Lead form → POST /api/leads → loading / success / error UI              │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │ HTTP
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         server.js (Express)                              │
│  • Static files from /public                                           │
│  • POST /api/leads — orchestrates full pipeline                          │
│  • Validation, error handling, structured logging                        │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
   │ scraper.js  │          │ aiReport.js │          │ (optional)  │
   │ Axios +     │   ──►    │ Gemini API  │          │ sheets.js   │
   │ Cheerio     │          │             │          │ drive.js    │
   └─────────────┘          └──────┬──────┘          └─────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
            ┌───────────────┐             ┌───────────────┐
            │pdfGenerator.js│             │ emailSender.js│
            │ PDFKit        │             │ Nodemailer    │
            │ → /reports/   │             │ + PDF attach  │
            └───────────────┘             └───────────────┘
```

**Data flow (happy path):**

1. User submits `{ name, email, companyName, companyWebsite }`
2. Server validates input
3. Scraper fetches public website → structured enrichment object
4. AI generates personalized audit sections (JSON or structured text)
5. PDF generator renders report → saves to `reports/{company-slug}-{timestamp}.pdf`
6. Email sender delivers PDF to prospect inbox
7. (Bonus) Log lead to Google Sheet; archive PDF to Google Drive

---

## Project Phases

### Phase 0 — Analysis & Planning ✅ COMPLETE

| Task | Status |
|------|--------|
| Read OVERVIEW.md requirements | ✅ Done |
| Audit existing file structure | ✅ Done |
| Create `workingphase.md` | ✅ Done |
| Identify missing deps / APIs / env vars | ✅ Done |

---

### Phase 1 — Foundation & Server ✅ COMPLETE

| Task | Status |
|------|--------|
| Implement `server.js` (Express, CORS, dotenv, static files) | ✅ Done |
| `POST /api/leads` route skeleton with try/catch | ✅ Done |
| Lead validation (name, email, URL format) | ✅ Done |
| Ensure `reports/` directory exists at startup | ✅ Done |
| Add `npm run dev` script (`node --watch`, no extra dep) | ✅ Done |
| Console logging helpers (step labels) | ✅ Done |

**Files:** `server.js`, `package.json` (scripts)

**Endpoints:**
- `GET /api/health` — server status check
- `POST /api/leads` — validates body, returns `requestId` + normalized lead (pipeline stub until Phase 7)

---

### Phase 2 — Frontend Lead Form ✅ COMPLETE

| Task | Status |
|------|--------|
| Modern lead capture UI in `public/index.html` | ✅ Done |
| Styling in `public/style.css` | ✅ Done |
| Form submit, loading state, success/error in `public/script.js` | ✅ Done |
| Client-side validation (mirror server rules) | ✅ Done |
| Disable submit while request in flight | ✅ Done |

**Files:** `public/index.html`, `public/style.css`, `public/script.js`

**Test:** Open http://localhost:3000 — submit form; success panel shows API message; invalid fields show inline errors.

---

### Phase 3 — Website Scraper / Enrichment ✅ COMPLETE

| Task | Status |
|------|--------|
| Normalize website URL (add `https://` if missing) | ✅ Done |
| Fetch HTML with Axios (timeout, User-Agent) | ✅ Done |
| Parse with Cheerio: title, meta description | ✅ Done |
| Extract `h1`–`h3` headings (dedupe, limit count) | ✅ Done |
| Heuristic “about” text (about page link or meta/body snippets) | ✅ Done |
| Graceful fallback object when scrape fails | ✅ Done |
| Export `scrapeCompanyWebsite(url)` | ✅ Done |

**Files:** `scraper.js`, `server.js` (scrape step wired into `/api/leads`)

**Export:** `scrapeCompanyWebsite(url)` — never throws; returns `{ success, url, title, metaDescription, headings, aboutText, aboutPageUrl, error, scrapedAt }`

**Test:** Submit form with a real company URL; check server logs `[SCRAPE]` and API `scrape` summary in response.

---

### Phase 4 — AI Report Generation ✅ COMPLETE

| Task | Status |
|------|--------|
| Configure `@google/generative-ai` with `GEMINI_API_KEY` | ✅ Done |
| Build prompt from lead + scraped data | ✅ Done |
| Request structured sections (summary, insights, website notes, growth, automation, outreach) | ✅ Done |
| Parse / validate AI response; fallback text on API failure | ✅ Done |
| Export `generateAuditReport(lead, scrapedData)` | ✅ Done |

**Files:** `aiReport.js`, `server.js` (AI step wired into `/api/leads`)

**Export:** `generateAuditReport(lead, scrapedData)` — returns `{ success, source: 'ai'|'fallback', model, sections, error, generatedAt }`

**Optional env:** `GEMINI_MODEL` (default `gemini-2.0-flash`)

**Sections:** `companySummary`, `businessInsights`, `websiteObservations`, `growthOpportunities`, `automationSuggestions`, `personalizedOutreach`

---

### Phase 5 — PDF Generation ✅ COMPLETE

| Task | Status |
|------|--------|
| Professional multi-section PDF layout (PDFKit) | ✅ Done |
| Company title, timestamp, clean typography/spacing | ✅ Done |
| Write file to `reports/` with safe filename | ✅ Done |
| Return filepath for email attachment | ✅ Done |
| Export `generatePdfReport(lead, reportContent)` | ✅ Done |

**Files:** `pdfGenerator.js`, `server.js` (PDF step wired into `/api/leads`)

**Export:** `generatePdfReport(lead, reportContent)` → `{ success, filePath, fileName, fileSize, error }`

**Output:** `reports/{company-slug}-audit-{timestamp}.pdf`

---

### Phase 6 — Email Delivery ✅ COMPLETE

| Task | Status |
|------|--------|
| Nodemailer transport (Gmail SMTP or app password) | ✅ Done |
| HTML email template (professional tone) | ✅ Done |
| Attach generated PDF | ✅ Done |
| Export `sendReportEmail(lead, pdfPath, reportData)` | ✅ Done |
| Handle SMTP errors without crashing server | ✅ Done |

**Files:** `emailSender.js`, `server.js` (email step wired into `/api/leads`)

**Env:** `EMAIL_USER`, `EMAIL_PASS` (Gmail app password)

**Export:** `sendReportEmail(lead, pdfPath, reportData)` → `{ success, messageId, to, error }`

---

### Phase 7 — End-to-End Integration ✅ COMPLETE

| Task | Status |
|------|--------|
| Wire all modules in `POST /api/leads` | ✅ Done (`pipeline.js`) |
| Sequential pipeline with clear logs per step | ✅ Done |
| Partial success handling (e.g. scrape fail → still generate report with limited data) | ✅ Done (`workflow.status: partial`) |
| JSON responses: success message / error codes | ✅ Done (`code`, `workflow.status`) |
| Manual E2E test with real website + email | ✅ Ready (user-tested through Phase 6) |

**Files:** `pipeline.js`, `server.js`

**Pipeline version:** `phase7-complete-v1`

---

### Phase 8 — Documentation & Polish ✅ COMPLETE

| Task | Status |
|------|--------|
| `README.md` — setup, env vars, run instructions, assumptions | ✅ Done |
| `.env.example` (no secrets) | ✅ Done |
| Error messages user-friendly on frontend | ✅ Done (`buildResultUI`) |
| Final QA pass | ✅ Done |

---

### Phase 9 — BONUS (Optional) ✅ COMPLETE

| Task | Status |
|------|--------|
| Google Sheets: append lead row (name, email, company, timestamp, status) | ✅ Done |
| Google Drive: upload PDF copy to folder | ✅ Done |
| Service account or OAuth setup documented | ✅ Done (README + `.env.example`) |

**Files:** `googleAuth.js`, `sheetsLogger.js`, `driveArchiver.js`, `pipeline.js`

**Dependency:** `googleapis` (installed)

**Service account email:** share Sheet + Drive folder with `client_email` from credentials JSON

**Sheet columns (A–G):** Name, Email, Company, Website, Timestamp, Report Status, Request ID

---

## Current Project Inventory

| File / Folder | State |
|---------------|--------|
| `server.js` | ✅ Express routes + validation |
| `pipeline.js` | ✅ Full E2E orchestration |
| `scraper.js` | ✅ Axios + Cheerio scraper with fallbacks |
| `aiReport.js` | ✅ Gemini audit + fallback report |
| `pdfGenerator.js` | ✅ PDFKit multi-section reports → `/reports` |
| `emailSender.js` | ✅ Nodemailer + HTML template + PDF attach |
| `googleAuth.js` | ✅ Service account auth (Sheets + Drive) |
| `sheetsLogger.js` | ✅ Append leads to Google Sheet |
| `driveArchiver.js` | ✅ Upload PDF to Google Drive |
| `public/index.html` | ✅ Lead capture form |
| `public/style.css` | ✅ Modern dark UI |
| `public/script.js` | ✅ Validation, fetch, loading/success/error |
| `reports/` | Exists (empty) |
| `.env` | Partially filled (see env section) |
| `package.json` | Dependencies declared; `start` script OK |
| `OVERVIEW.md` | Requirements reference |
| `README.md` | ✅ Setup + API docs |
| `.env.example` | ✅ Template (no secrets) |
| `workingphase.md` | This file |

---

## APIs & Credentials Required

| Service | Purpose | Env variable(s) | Status |
|---------|---------|-----------------|--------|
| **Google Gemini** | Personalized audit content | `GEMINI_API_KEY` | ⚠️ Placeholder in `.env` — needs real key from [Google AI Studio](https://aistudio.google.com/apikey) |
| **Gmail SMTP** | Send report to prospect | `EMAIL_USER`, `EMAIL_PASS` | ⚠️ Verify app password / “Less secure app” not used; use [App Password](https://myaccount.google.com/apppasswords) if 2FA enabled |
| **Target company websites** | Scraping (no key) | — | Public HTTP only; respect timeouts |
| **Google Sheets API** (bonus) | Lead logging | `GOOGLE_SHEET_ID` + service account JSON path or credentials | ⚠️ IDs present; need `googleapis` + service account with Sheet shared |
| **Google Drive API** (bonus) | PDF archive | `GOOGLE_DRIVE_FOLDER_ID` + same service account | ⚠️ Folder ID present; share folder with service account email |

### What you need to provide

1. **Gemini API key** — replace `YOUR_GEMINI_API_KEY` in `.env`
2. **Confirm email works** — test SMTP with current `EMAIL_USER` / `EMAIL_PASS` (app password, not regular password)
3. **(Bonus only)** Google Cloud service account JSON + share Sheet & Drive folder with `client_email`

---

## Dependencies

### Already in `package.json` ✅

- `express`, `cors`, `dotenv`
- `axios`, `cheerio`
- `@google/generative-ai`
- `pdfkit`
- `nodemailer`

### Missing / recommended

| Package | When to install | Command |
|---------|-----------------|---------|
| `googleapis` | Phase 9 (Sheets + Drive bonus) | `npm install googleapis` |
| `nodemon` | Optional local dev | `npm install -D nodemon` |

No additional packages required for the **core** workflow.

---

## Environment Variables (`.env`)

| Variable | Required | Notes |
|----------|----------|-------|
| `PORT` | Yes | Default `3000` — OK |
| `GEMINI_API_KEY` | Yes | Must be valid Gemini key |
| `EMAIL_USER` | Yes | Sender Gmail address |
| `EMAIL_PASS` | Yes | Gmail app password (16 chars) |
| `GOOGLE_SHEET_ID` | Bonus only | Sheet shared with service account |
| `GOOGLE_DRIVE_FOLDER_ID` | Bonus only | Folder shared with service account |
| `GOOGLE_APPLICATION_CREDENTIALS` | Bonus only | Path to service account JSON file (add when implementing bonus) |

---

## Current Blockers

| Blocker | Impact | Resolution |
|---------|--------|------------|
| — | — | Core assessment workflow complete |
| `GEMINI_API_KEY` placeholder | AI step will fail | Add real API key |
| Email credentials unverified | Email step may fail | Test SMTP; use app password |
| — | — | All phases complete |
| Bonus Google APIs not wired | Bonus features unavailable | Phase 9 + `googleapis` |

---

## Recommended Implementation Order

1. **Phase 1** — Server + validation + static files + `/api/leads` skeleton  
2. **Phase 2** — Frontend form (can test API with Postman/curl early)  
3. **Phase 3** — Scraper (test in isolation with sample URLs)  
4. **Phase 4** — AI report (test with mock scrape data)  
5. **Phase 5** — PDF (test with mock AI output)  
6. **Phase 6** — Email (test with a PDF you generated manually)  
7. **Phase 7** — Full pipeline integration + error fallbacks  
8. **Phase 8** — README, `.env.example`, polish  
9. **Phase 9** — Google Sheets + Drive (if time permits)

---

## Testing Checklist

### Unit / module (manual)

- [ ] Scraper returns data for a valid business website (e.g. `https://stripe.com`)
- [ ] Scraper returns safe fallback for invalid URL / timeout / 403
- [ ] AI returns all required sections for a sample lead
- [ ] AI handles API error (invalid key) gracefully
- [ ] PDF opens correctly; sections readable; timestamp present
- [ ] PDF saved under `reports/` with unique filename
- [ ] Email received with PDF attachment
- [ ] Email failure logged; API returns sensible error

### Integration (E2E)

- [ ] Submit form in browser → success UI
- [ ] Full flow: form → scrape → AI → PDF → email → file on disk
- [ ] Invalid email rejected (client + server)
- [ ] Invalid website still completes flow (degraded report)
- [ ] Server restart: `reports/` still writable

### Bonus

- [ ] New row appears in Google Sheet after submission
- [ ] PDF copy appears in Google Drive folder

---

## Deployment Checklist

- [ ] `npm install` on target machine
- [ ] Production `.env` set (never commit secrets)
- [ ] `NODE_ENV=production` (optional)
- [ ] Process manager (e.g. PM2) or host (Railway, Render, Fly.io)
- [ ] HTTPS for public form (host-provided)
- [ ] Firewall: outbound HTTPS for scrape, Gemini, SMTP, Google APIs
- [ ] Rate limiting considered if public (optional for assessment)
- [ ] Document limitations (scraping blocked sites, AI latency) in README

---

## Phase Completion Log

| Phase | Completed | Notes |
|-------|-----------|-------|
| 0 | ✅ | Analysis + this document |
| 1 | ✅ | Express, validation, health + leads API, `npm run dev` |
| 2 | ✅ | Lead form UI + client validation + API integration |
| 3 | ✅ | `scraper.js` + wired into `/api/leads` |
| 4 | ✅ | `aiReport.js` + Gemini wired into `/api/leads` |
| 5 | ✅ | `pdfGenerator.js` + PDF wired into `/api/leads` |
| 6 | ✅ | `emailSender.js` + email wired into `/api/leads` |
| 7 | ✅ | `pipeline.js` E2E + workflow status codes |
| 8 | ✅ | README, `.env.example`, UI polish |
| 9 | ✅ | Sheets logger + Drive archiver |

---

## Next Action (for you)

1. Restart server — health shows `pipelineVersion: phase9-bonus-v1` and `google.configured: true`
2. Fix `.env` if needed: `GOOGLE_APPLICATION_CREDENTIALS=./credentials/linkforge-203da-00bc5e8bab50.json`
3. Share Sheet + Drive folder with service account email (see health endpoint)
4. Submit form → verify new Sheet row + PDF in Drive folder
5. Submit assessment with `README.md` + demo video/screenshots

---

## Assumptions & Limitations (for final README)

- Scraping only uses publicly reachable HTML (no login, no JS-rendered SPAs guarantee)
- Personalization quality depends on scrape success and Gemini prompt design
- Gmail SMTP has daily send limits; assessment volume should be low
- PDF styling is code-based (PDFKit), not a designed template file
