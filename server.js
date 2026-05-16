require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { runLeadPipeline, PIPELINE_VERSION } = require('./pipeline');
const { isApiKeyConfigured } = require('./aiReport');
const { isEmailConfigured } = require('./emailSender');
const { isGoogleConfigured, getServiceAccountEmail, resolveCredentialsPath } = require('./googleAuth');
const { scrapeCompanyWebsite } = require('./scraper');
const { generateAuditReport } = require('./aiReport');
const { generatePdfReport } = require('./pdfGenerator');
const { sendReportEmail } = require('./emailSender');

const required = [
  ['scrapeCompanyWebsite', scrapeCompanyWebsite],
  ['generateAuditReport', generateAuditReport],
  ['generatePdfReport', generatePdfReport],
  ['sendReportEmail', sendReportEmail],
  ['runLeadPipeline', runLeadPipeline],
];

for (const [name, fn] of required) {
  if (typeof fn !== 'function') {
    console.error(`[FATAL] Missing export: ${name}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const REPORTS_DIR = path.join(__dirname, 'reports');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function log(step, message, meta) {
  const time = new Date().toISOString();
  const prefix = `[${time}] [${step}]`;
  if (meta !== undefined) {
    console.log(prefix, message, meta);
  } else {
    console.log(prefix, message);
  }
}

function logError(step, message, err) {
  const time = new Date().toISOString();
  console.error(`[${time}] [${step}] ${message}`, err?.message || err);
}

function normalizeWebsiteUrl(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function isValidWebsite(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

function validateLead(body) {
  const errors = [];
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const companyName = String(body?.companyName || '').trim();
  const companyWebsiteRaw = String(body?.companyWebsite || '').trim();
  const companyWebsite = normalizeWebsiteUrl(companyWebsiteRaw);

  if (!name || name.length < 2) errors.push('Name is required (at least 2 characters).');
  if (!email || !EMAIL_REGEX.test(email)) errors.push('A valid email address is required.');
  if (!companyName || companyName.length < 2) {
    errors.push('Company name is required (at least 2 characters).');
  }
  if (!companyWebsiteRaw) {
    errors.push('Company website is required.');
  } else if (!isValidWebsite(companyWebsite)) {
    errors.push('Company website must be a valid URL (e.g. https://example.com).');
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    lead: { name, email, companyName, companyWebsite },
  };
}

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  log('INIT', 'Created reports directory', REPORTS_DIR);
} else {
  log('INIT', 'Reports directory ready', REPORTS_DIR);
}

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    status: 'ok',
    pipelineVersion: PIPELINE_VERSION,
    modules: {
      scraper: true,
      ai: isApiKeyConfigured(),
      email: isEmailConfigured(),
      google: isGoogleConfigured(),
    },
    google: {
      configured: isGoogleConfigured(),
      credentialsPath: resolveCredentialsPath(),
      serviceAccountEmail: getServiceAccountEmail(),
    },
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/leads', async (req, res) => {
  const requestId = Date.now().toString(36);

  log('LEAD', `Request ${requestId} — received`);

  const validation = validateLead(req.body);
  if (!validation.valid) {
    log('LEAD', `Request ${requestId} — validation failed`, validation.errors);
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Please check your form and try again.',
      errors: validation.errors,
      pipelineVersion: PIPELINE_VERSION,
    });
  }

  log('LEAD', `Request ${requestId} — validation passed`, {
    company: validation.lead.companyName,
    email: validation.lead.email,
  });

  const result = await runLeadPipeline(validation.lead, requestId);
  return res.status(result.httpStatus).json(result.body);
});

app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

const server = app.listen(PORT, () => {
  log('INIT', 'All pipeline modules loaded');
  log('INIT', `Gemini configured: ${isApiKeyConfigured()}`);
  log('INIT', `Email configured: ${isEmailConfigured()}`);
  log('INIT', `Google bonus configured: ${isGoogleConfigured()}`);
  if (getServiceAccountEmail()) {
    log('INIT', `Service account: ${getServiceAccountEmail()}`);
  }
  log('SERVER', `Running at http://localhost:${PORT}`);
  log('SERVER', `Pipeline: ${PIPELINE_VERSION}`);
  log('SERVER', `Debug logs: ${process.env.DEBUG_PIPELINE === 'true' ? 'on' : 'off'} (set DEBUG_PIPELINE=true to enable)`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `[FATAL] Port ${PORT} is in use. Stop the old server, then run npm run dev again.`
    );
  } else {
    console.error('[FATAL] Server failed to start', err.message);
  }
  process.exit(1);
});
