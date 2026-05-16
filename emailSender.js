const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function log(step, message, meta) {
  const time = new Date().toISOString();
  if (meta !== undefined) {
    console.log(`[${time}] [${step}]`, message, meta);
  } else {
    console.log(`[${time}] [${step}]`, message);
  }
}

function isEmailConfigured() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  return Boolean(user && pass && !String(pass).toLowerCase().includes('your_'));
}

function getFirstName(fullName) {
  return String(fullName || 'there').trim().split(/\s+/)[0] || 'there';
}

function buildHtmlEmail(lead, reportData) {
  const firstName = getFirstName(lead.name);
  const rawSummary =
    reportData?.sections?.companySummary ||
    `We prepared a tailored audit for ${lead.companyName} based on your website and public business information.`;
  const summary = rawSummary.length > 280 ? `${rawSummary.slice(0, 277)}...` : rawSummary;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:Arial,Helvetica,sans-serif;line-height:1.6;color:#1f2937;margin:0;padding:0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="border-bottom:3px solid #1e40af;padding-bottom:16px;margin-bottom:24px;">
      <p style="font-size:22px;font-weight:700;color:#1e40af;margin:0;">SimplifIQ</p>
      <p style="color:#6b7280;font-size:14px;margin:4px 0 0;">Personalized Business Audit</p>
    </div>
    <p>Hi ${firstName},</p>
    <p>Thank you for your interest in <strong>${lead.companyName}</strong>. We completed an automated review of your business and website (<a href="${lead.companyWebsite}">${lead.companyWebsite}</a>).</p>
    <div style="background:#f8fafc;border-radius:8px;padding:20px;margin:20px 0;">
      <p style="margin:0 0 8px;font-weight:600;">Executive snapshot</p>
      <p style="margin:0;">${summary}</p>
    </div>
    <p>Your full audit report is attached as a PDF, including business insights, website observations, growth opportunities, automation suggestions, and a personalized outreach note.</p>
    <p>If you'd like to discuss next steps, reply to this email — we'd be happy to help.</p>
    <p>Best regards,<br/><strong>The SimplifIQ Team</strong></p>
    <p style="margin-top:32px;font-size:12px;color:#9ca3af;">Generated automatically from public information and your form submission.</p>
  </div>
</body>
</html>`;
}

function buildTextEmail(lead, reportData) {
  const firstName = getFirstName(lead.name);
  const summary =
    reportData?.sections?.companySummary?.slice(0, 400) ||
    `We prepared a tailored audit for ${lead.companyName}.`;

  return `Hi ${firstName},

Thank you for your interest in ${lead.companyName}.

${summary}

Your full audit report is attached as a PDF.

Best regards,
The SimplifIQ Team`;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

/**
 * Send the audit PDF to the prospect via email.
 * Never throws — returns { success, messageId, to, error }.
 */
async function sendReportEmail(lead, pdfPath, reportData = {}) {
  const to = lead.email;

  log('EMAIL', 'Preparing to send report', { to, company: lead.companyName });

  if (!isEmailConfigured()) {
    log('EMAIL', 'EMAIL_USER / EMAIL_PASS not configured');
    return {
      success: false,
      messageId: null,
      to,
      error: 'Email credentials not configured in .env',
    };
  }

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    log('EMAIL', 'PDF file missing — cannot attach', pdfPath);
    return {
      success: false,
      messageId: null,
      to,
      error: 'PDF file not found for email attachment',
    };
  }

  const fileName = path.basename(pdfPath);
  const subject = `Your ${lead.companyName} Business Audit — SimplifIQ`;

  try {
    const transporter = createTransporter();
    const info = await transporter.sendMail({
      from: {
        name: 'SimplifIQ',
        address: process.env.EMAIL_USER,
      },
      to,
      subject,
      text: buildTextEmail(lead, reportData),
      html: buildHtmlEmail(lead, reportData),
      attachments: [
        {
          filename: fileName,
          path: pdfPath,
          contentType: 'application/pdf',
        },
      ],
    });

    log('EMAIL', 'Report email sent', { to, messageId: info.messageId });

    return {
      success: true,
      messageId: info.messageId,
      to,
      error: null,
    };
  } catch (err) {
    log('EMAIL', 'Failed to send email', err.message);
    return {
      success: false,
      messageId: null,
      to,
      error: err.message || 'Email delivery failed',
    };
  }
}

module.exports = {
  sendReportEmail,
  isEmailConfigured,
};
