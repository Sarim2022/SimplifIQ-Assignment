const { getSheetsClient, isGoogleConfigured } = require('./googleAuth');

const DEFAULT_RANGE = 'Sheet1!A:G';

function log(step, message, meta) {
  const time = new Date().toISOString();
  if (meta !== undefined) {
    console.log(`[${time}] [${step}]`, message, meta);
  } else {
    console.log(`[${time}] [${step}]`, message);
  }
}

function formatReportStatus(workflowStatus) {
  const map = {
    complete: 'Delivered',
    partial: 'Delivered (limited scrape)',
    email_failed: 'PDF ok — email failed',
    pdf_failed: 'PDF failed',
    processing: 'Processing',
  };
  return map[workflowStatus] || workflowStatus || 'Unknown';
}

/**
 * Append lead row to Google Sheet.
 * Columns: Name | Email | Company | Website | Timestamp | Report Status | Request ID
 */
async function appendLeadToSheet(lead, meta = {}) {
  if (!isGoogleConfigured()) {
    return {
      success: false,
      error: 'Google Sheets not configured (credentials, GOOGLE_SHEET_ID)',
    };
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const range = process.env.GOOGLE_SHEET_RANGE || DEFAULT_RANGE;
  const timestamp = meta.timestamp || new Date().toISOString();
  const reportStatus = formatReportStatus(meta.reportStatus);

  const row = [
    lead.name,
    lead.email,
    lead.companyName,
    lead.companyWebsite,
    timestamp,
    reportStatus,
    meta.requestId || '',
  ];

  try {
    const sheets = await getSheetsClient();
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [row] },
    });

    log('SHEETS', 'Lead row appended', {
      updatedRange: response.data.updates?.updatedRange,
      reportStatus,
    });

    return {
      success: true,
      updatedRange: response.data.updates?.updatedRange || null,
      error: null,
    };
  } catch (err) {
    log('SHEETS', 'Failed to append row', err.message);
    return {
      success: false,
      updatedRange: null,
      error: err.message || 'Sheets append failed',
    };
  }
}

module.exports = {
  appendLeadToSheet,
  formatReportStatus,
};
