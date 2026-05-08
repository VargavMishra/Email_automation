import { env } from '../../config/env.js';
import { logger } from '../../logger.js';
import { parseDriveFolderId } from './studio.utils.js';

async function driveRequest(path) {
  const response = await fetch(`${env.GOOGLE_DRIVE_API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${env.GOOGLE_DRIVE_ACCESS_TOKEN}`
    },
    signal: AbortSignal.timeout(15000)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Drive API request failed (${response.status}): ${errorBody}`);
  }

  return response.json();
}

export async function validateDriveFolderLink(link) {
  const folderId = parseDriveFolderId(link);

  if (!folderId) {
    return {
      ok: false,
      folderId: null,
      sharing: 'INVALID',
      reason: 'Google Drive folder link is missing or malformed.'
    };
  }

  if (!env.GOOGLE_DRIVE_ACCESS_TOKEN) {
    return {
      ok: true,
      folderId,
      sharing: 'UNKNOWN',
      webViewLink: link,
      reason: 'Folder URL format is valid. Configure GOOGLE_DRIVE_ACCESS_TOKEN to enforce sharing checks automatically.'
    };
  }

  try {
    const [file, permissions] = await Promise.all([
      driveRequest(`/files/${folderId}?fields=id,name,mimeType,trashed,webViewLink`),
      driveRequest(`/files/${folderId}/permissions?fields=permissions(id,type,role,allowFileDiscovery)`)
    ]);

    const publicPermission = permissions.permissions?.find((permission) =>
      permission.type === 'anyone' && ['reader', 'commenter'].includes(permission.role)
    );

    return {
      ok: Boolean(file?.id) && !file?.trashed,
      folderId,
      sharing: publicPermission ? 'PUBLIC_VIEW' : 'RESTRICTED',
      webViewLink: file?.webViewLink ?? link,
      reason: publicPermission
        ? undefined
        : 'Google Drive folder exists but is not shared as view-only for link recipients.'
    };
  } catch (error) {
    logger.warn('Google Drive validation failed', {
      error: error.message,
      folderId
    });

    return {
      ok: false,
      folderId,
      sharing: 'ERROR',
      reason: 'Unable to validate the Google Drive folder with the Drive API.'
    };
  }
}
