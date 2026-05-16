# SimplifIQ — Lead Automation Assessment

**Automated lead follow-up:** form submit → scrape website → AI audit → PDF → email to prospect. No manual steps.

| Step | What happens |
|------|----------------|
| 1 | Validate lead (name, email, company, website) |
| 2 | Scrape public site (title, meta, headings, about) |
| 3 | Generate 6-section audit (Gemini, or fallback if API fails) |
| 4 | Save branded PDF to `reports/` |
| 5 | Email PDF to prospect (Gmail SMTP) |
| 6 | **Bonus:** Log lead to Google Sheets |

**Stack:** Node.js, Express, Cheerio, Gemini, PDFKit, Nodemailer, Google Sheets API

---

## Run locally

```bash
npm install
cp .env.example .env   # add GEMINI_API_KEY, EMAIL_USER, EMAIL_PASS
npm run dev
```

Open **http://localhost:3000** · Health check: **http://localhost:3000/api/health**

---

## Environment (minimum)

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | AI audit ([Google AI Studio](https://aistudio.google.com/apikey)) |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail + [app password](https://myaccount.google.com/apppasswords) |
| `GOOGLE_SHEET_ID` + `GOOGLE_APPLICATION_CREDENTIALS` | Bonus Sheets logging (optional) |

See `.env.example` for all options.

---

## Reliability

If scrape or Gemini fails, the pipeline **still completes** using fallback data where possible. PDF/email only skip when that step itself fails. Details in API response `workflow.status` (`complete`, `partial`, `email_failed`, `pdf_failed`).

**Limits:** static HTML scraping only (not full SPAs); Gemini/Gmail quotas apply; synchronous request (fine for prototype).

---

## Bonus: Google Sheets

1. Service account JSON in `credentials/` (gitignored)  
2. Enable Sheets API · share spreadsheet with service account email (Editor)  
3. Row 1 headers: `Name | Email | Company | Website | Timestamp | Report Status | Request ID`

---

## For reviewers

- **Entry:** `server.js` · **Orchestration:** `pipeline.js` · Modules: `scraper`, `aiReport`, `pdfGenerator`, `emailSender`, `sheetsLogger`
- **API:** `POST /api/leads` with JSON body `{ name, email, companyName, companyWebsite }`
- Built with AI tools per brief; integration and E2E flow verified locally
- Assessment spec: `OVERVIEW.md`

---

## Scripts

`npm start` · `npm run dev` (auto-reload)
