const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const REPORTS_DIR = path.join(__dirname, 'reports');

const SECTION_LAYOUT = [
  { key: 'companySummary', title: 'Company Summary' },
  { key: 'businessInsights', title: 'Business Insights' },
  { key: 'websiteObservations', title: 'Website Observations' },
  { key: 'growthOpportunities', title: 'Growth Opportunities' },
  { key: 'automationSuggestions', title: 'Automation Suggestions' },
  { key: 'personalizedOutreach', title: 'Personalized Outreach Note' },
];

const COLORS = {
  primary: '#1e40af',
  text: '#1f2937',
  muted: '#6b7280',
  line: '#e5e7eb',
};

function log(step, message, meta) {
  const time = new Date().toISOString();
  if (meta !== undefined) {
    console.log(`[${time}] [${step}]`, message, meta);
  } else {
    console.log(`[${time}] [${step}]`, message);
  }
}

function slugify(text) {
  return String(text || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'report';
}

function formatTimestamp(isoString) {
  const date = isoString ? new Date(isoString) : new Date();
  return date.toLocaleString('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

function ensureReportsDir() {
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
}

function buildFileName(lead) {
  const slug = slugify(lead.companyName);
  const stamp = Date.now();
  return `${slug}-audit-${stamp}.pdf`;
}

function checkPageSpace(doc, neededHeight = 120) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight > bottom) {
    doc.addPage();
    drawPageFooter(doc);
  }
}

function drawPageFooter(doc) {
  const bottom = doc.page.height - doc.page.margins.bottom + 15;
  doc
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text('SimplifIQ — Confidential business audit', doc.page.margins.left, bottom, {
      align: 'center',
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
}

function drawHeader(doc, lead, reportContent) {
  const margin = doc.page.margins.left;
  const contentWidth = doc.page.width - margin * 2;

  doc
    .fontSize(22)
    .fillColor(COLORS.primary)
    .text('SimplifIQ', margin, doc.y, { continued: false });

  doc
    .fontSize(10)
    .fillColor(COLORS.muted)
    .text('Business Audit Report', margin, doc.y + 2);

  doc.moveDown(1.2);

  doc
    .fontSize(18)
    .fillColor(COLORS.text)
    .text(lead.companyName, margin, doc.y, { width: contentWidth });

  doc.moveDown(0.4);

  doc.fontSize(10).fillColor(COLORS.muted);
  doc.text(`Website: ${lead.companyWebsite}`, { width: contentWidth });
  doc.text(`Prepared for: ${lead.name} (${lead.email})`, { width: contentWidth });
  doc.text(`Generated: ${formatTimestamp(reportContent.generatedAt)}`, { width: contentWidth });

  if (reportContent.source) {
    doc.text(`Report source: ${reportContent.source}${reportContent.model ? ` · ${reportContent.model}` : ''}`, {
      width: contentWidth,
    });
  }

  doc.moveDown(0.8);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .moveTo(margin, doc.y)
    .lineTo(margin + contentWidth, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

function drawSection(doc, title, body) {
  const margin = doc.page.margins.left;
  const contentWidth = doc.page.width - margin * 2;
  const text = String(body || 'No content available for this section.').trim();

  checkPageSpace(doc, 100);

  doc.fontSize(13).fillColor(COLORS.primary).text(title, margin, doc.y, { width: contentWidth });
  doc.moveDown(0.35);

  doc.fontSize(11).fillColor(COLORS.text).text(text, margin, doc.y, {
    width: contentWidth,
    align: 'left',
    lineGap: 5,
  });

  doc.moveDown(0.9);
}

function renderPdfToFile(filePath, lead, reportContent) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 56, bottom: 56, left: 56, right: 56 },
      info: {
        Title: `${lead.companyName} — Business Audit`,
        Author: 'SimplifIQ',
        Subject: 'Automated Business Audit Report',
      },
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    drawHeader(doc, lead, reportContent);

    const sections = reportContent.sections || {};
    for (const { key, title } of SECTION_LAYOUT) {
      drawSection(doc, title, sections[key]);
    }

    drawPageFooter(doc);

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
    doc.on('error', reject);
  });
}

/**
 * Generate a professional PDF audit and save to /reports.
 * @param {object} lead - { name, email, companyName, companyWebsite }
 * @param {object} reportContent - output from generateAuditReport (sections, generatedAt, source, model)
 * @returns {Promise<{ success, filePath, fileName, error }>}
 */
async function generatePdfReport(lead, reportContent) {
  ensureReportsDir();

  const fileName = buildFileName(lead);
  const filePath = path.join(REPORTS_DIR, fileName);

  log('PDF', 'Generating PDF report', { company: lead.companyName, fileName });

  try {
    if (!reportContent?.sections) {
      throw new Error('Report sections missing — run AI report step first');
    }

    await renderPdfToFile(filePath, lead, reportContent);

    const stats = fs.statSync(filePath);
    log('PDF', 'PDF saved', { filePath, bytes: stats.size });

    return {
      success: true,
      filePath,
      fileName,
      fileSize: stats.size,
      error: null,
    };
  } catch (err) {
    log('PDF', 'PDF generation failed', err.message);
    return {
      success: false,
      filePath: null,
      fileName: null,
      fileSize: 0,
      error: err.message || 'PDF generation failed',
    };
  }
}

module.exports = {
  generatePdfReport,
  REPORTS_DIR,
};
