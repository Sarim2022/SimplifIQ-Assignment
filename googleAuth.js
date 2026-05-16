const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const SHEETS_SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// drive.file cannot upload into user-shared folders (no SA storage quota).
// Full drive scope is required for files in folders shared with the service account.
const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

let cachedSheetsAuth = null;
let cachedDriveAuth = null;
let cachedClientEmail = null;

function resolveCredentialsPath() {
  const fromEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (fromEnv) {
    const resolved = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    if (fs.existsSync(resolved)) return resolved;
  }

  const credDir = path.join(__dirname, 'credentials');
  if (!fs.existsSync(credDir)) return null;

  const jsonFiles = fs
    .readdirSync(credDir)
    .filter((file) => file.endsWith('.json'))
    .sort();

  if (jsonFiles.length === 0) return null;
  return path.join(credDir, jsonFiles[0]);
}

function readServiceAccountKey() {
  const credPath = resolveCredentialsPath();
  if (!credPath) return null;
  return JSON.parse(fs.readFileSync(credPath, 'utf8'));
}

function isGoogleConfigured() {
  const credPath = resolveCredentialsPath();
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  return Boolean(credPath && sheetId && folderId);
}

function getServiceAccountEmail() {
  if (cachedClientEmail) return cachedClientEmail;
  const key = readServiceAccountKey();
  cachedClientEmail = key?.client_email || null;
  return cachedClientEmail;
}

async function getSheetsAuth() {
  if (cachedSheetsAuth) return cachedSheetsAuth;

  const credPath = resolveCredentialsPath();
  if (!credPath) throw new Error('Google credentials JSON not found');

  cachedSheetsAuth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: SHEETS_SCOPES,
  });

  return cachedSheetsAuth;
}

/**
 * Drive auth uses the full `drive` scope so uploads land in folders shared with the SA
 * (uses the folder owner's storage, not the service account's empty quota).
 * Optional GOOGLE_IMPERSONATE_USER for Google Workspace domain-wide delegation.
 */
async function getDriveAuth() {
  if (cachedDriveAuth) return cachedDriveAuth;

  const key = readServiceAccountKey();
  if (!key) throw new Error('Google credentials JSON not found');

  const impersonateUser = process.env.GOOGLE_IMPERSONATE_USER?.trim();

  if (impersonateUser) {
    cachedDriveAuth = new google.auth.JWT({
      email: key.client_email,
      key: key.private_key,
      scopes: DRIVE_SCOPES,
      subject: impersonateUser,
    });
    await cachedDriveAuth.authorize();
    return cachedDriveAuth;
  }

  const credPath = resolveCredentialsPath();
  cachedDriveAuth = new google.auth.GoogleAuth({
    keyFile: credPath,
    scopes: DRIVE_SCOPES,
  });

  return cachedDriveAuth;
}

async function getSheetsClient() {
  const auth = await getSheetsAuth();
  return google.sheets({ version: 'v4', auth });
}

async function getDriveClient() {
  const auth = await getDriveAuth();
  return google.drive({ version: 'v3', auth });
}

module.exports = {
  isGoogleConfigured,
  getSheetsAuth,
  getDriveAuth,
  getSheetsClient,
  getDriveClient,
  getServiceAccountEmail,
  resolveCredentialsPath,
};
