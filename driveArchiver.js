const fs = require('fs');
const path = require('path');
const { getDriveClient, isGoogleConfigured, getServiceAccountEmail } = require('./googleAuth');

const SUPPORTS_ALL_DRIVES = { supportsAllDrives: true };

function log(step, message, meta) {
  const time = new Date().toISOString();
  if (meta !== undefined) {
    console.log(`[${time}] [${step}]`, message, meta);
  } else {
    console.log(`[${time}] [${step}]`, message);
  }
}

function isStorageQuotaError(message) {
  const text = String(message || '').toLowerCase();
  return text.includes('storage quota') || text.includes('do not have storage');
}

function buildQuotaHelpMessage(folderMeta) {
  const saEmail = getServiceAccountEmail() || 'your-service-account@project.iam.gserviceaccount.com';
  const folderHint = folderMeta
    ? folderMeta.isSharedDrive
      ? `Folder "${folderMeta.name}" is in a Shared Drive — ensure ${saEmail} is a member of that Shared Drive with Content Manager or Manager role.`
      : `Folder "${folderMeta.name}" is in My Drive (not a Shared Drive). Google blocks SA uploads here. Create a folder inside a Shared Drive (Workspace), share it with ${saEmail} as Editor, and update GOOGLE_DRIVE_FOLDER_ID.`
    : '';

  return [
    'Service accounts cannot use personal Drive storage.',
    folderHint,
    `Alternatively set GOOGLE_IMPERSONATE_USER for Workspace domain-wide delegation.`,
    'See README bonus section.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Verify the upload folder exists and accepts uploads from the service account.
 */
async function resolveUploadFolder(drive, folderId) {
  const response = await drive.files.get({
    fileId: folderId,
    fields: 'id, name, mimeType, driveId, shared, capabilities',
    ...SUPPORTS_ALL_DRIVES,
  });

  const folder = response.data;

  if (folder.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('GOOGLE_DRIVE_FOLDER_ID must be a folder, not a file');
  }

  if (folder.capabilities && folder.capabilities.canAddChildren === false) {
    throw new Error(
      `Service account cannot upload to folder "${folder.name}". Share this folder (Editor) with ${getServiceAccountEmail()}`
    );
  }

  return {
    id: folder.id,
    name: folder.name,
    driveId: folder.driveId || process.env.GOOGLE_SHARED_DRIVE_ID || null,
    isSharedDrive: Boolean(folder.driveId),
  };
}

/**
 * Upload PDF into a folder shared with the service account (or Shared Drive).
 * Files are stored under the folder owner's quota — never the SA's empty quota.
 */
async function uploadPdfToDrive(pdfPath, fileName) {
  if (!isGoogleConfigured()) {
    return {
      success: false,
      fileId: null,
      webViewLink: null,
      error: 'Google Drive not configured',
    };
  }

  if (!pdfPath || !fs.existsSync(pdfPath)) {
    return {
      success: false,
      fileId: null,
      webViewLink: null,
      error: 'PDF file not found for Drive upload',
    };
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const uploadName = fileName || path.basename(pdfPath);
  let folderMeta = null;

  try {
    const drive = await getDriveClient();

    const folder = await resolveUploadFolder(drive, folderId);
    folderMeta = folder;
    log('DRIVE', 'Upload target resolved', {
      folder: folder.name,
      sharedDrive: folder.isSharedDrive,
      impersonating: Boolean(process.env.GOOGLE_IMPERSONATE_USER),
    });

    const requestBody = {
      name: uploadName,
      parents: [folder.id],
    };

    const createParams = {
      requestBody,
      media: {
        mimeType: 'application/pdf',
        body: fs.createReadStream(pdfPath),
      },
      fields: 'id, name, webViewLink, parents',
      supportsAllDrives: true,
      enforceSingleParent: true,
    };

    const response = await drive.files.create(createParams);

    log('DRIVE', 'PDF archived', {
      fileId: response.data.id,
      name: response.data.name,
      parentFolder: folder.name,
    });

    return {
      success: true,
      fileId: response.data.id,
      webViewLink: response.data.webViewLink || null,
      parentFolder: folder.name,
      sharedDrive: folder.isSharedDrive,
      error: null,
    };
  } catch (err) {
    const message = err.message || 'Drive upload failed';
    log('DRIVE', 'Upload failed', message);

    return {
      success: false,
      fileId: null,
      webViewLink: null,
      error: isStorageQuotaError(message)
        ? `${message} — ${buildQuotaHelpMessage(folderMeta)}`
        : message,
    };
  }
}

module.exports = {
  uploadPdfToDrive,
  resolveUploadFolder,
};
