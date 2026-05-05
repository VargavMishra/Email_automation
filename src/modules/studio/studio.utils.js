import { deliveryTonePresets } from './studio.constants.js';

export function coerceOptionalDate(value) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function parseDriveFolderId(link = '') {
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];

  for (const pattern of patterns) {
    const match = link.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

export function getDeliveryEligibility(project) {
  const reasons = [];
  const followUpSatisfied = !project.requiresFollowUp || Boolean(project.followUpSentAt);

  if (project.status !== 'COMPLETED') {
    reasons.push('Project status must be COMPLETED before the delivery email can be sent.');
  }

  if (!followUpSatisfied) {
    reasons.push('Client check-in is still pending for this project.');
  }

  if (project.deliveryEmailSent) {
    reasons.push('Delivery email has already been sent.');
  }

  if (!project.driveFolderLink) {
    reasons.push('Google Drive folder link is missing.');
  }

  return {
    eligible: reasons.length === 0,
    followUpSatisfied,
    reasons
  };
}

export function computeBackoffDelayMs(attemptNumber, baseDelayMs) {
  const cappedAttempt = Math.min(Math.max(attemptNumber, 1), 6);
  return baseDelayMs * (2 ** (cappedAttempt - 1));
}

function isLocalAppUrl(appUrl) {
  try {
    const hostname = new URL(appUrl).hostname;
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch {
    return false;
  }
}

export function buildTrackingUrls({ appUrl, openTrackingToken, clickTrackingToken, driveFolderLink }) {
  if (isLocalAppUrl(appUrl)) {
    return {
      openPixelUrl: null,
      trackedDriveUrl: driveFolderLink,
      isTrackingEnabled: false
    };
  }

  const baseUrl = appUrl.replace(/\/$/, '');

  return {
    openPixelUrl: `${baseUrl}/api/studio/tracking/open/${openTrackingToken}`,
    trackedDriveUrl: `${baseUrl}/api/studio/tracking/click/${clickTrackingToken}`,
    isTrackingEnabled: true
  };
}

export function renderDeliveryTemplate({
  project,
  tone = project.deliveryTemplateTone ?? 'FORMAL',
  subjectOverride,
  messageOverride,
  includeRevisionCta = true,
  includeFeedbackCta = true,
  appUrl,
  openTrackingToken,
  clickTrackingToken
}) {
  const clientName = project.client?.name ?? 'there';
  const brandName = project.client?.brandName ?? 'your brand';
  const selectedTone = deliveryTonePresets[tone] ? tone : 'FORMAL';
  const preset = deliveryTonePresets[selectedTone];
  const style = preset.style;
  const subject = subjectOverride ?? preset.subject({
    brandName,
    projectCode: project.projectCode
  });
  const message = messageOverride ?? preset.intro({
    brandName,
    title: project.title
  });
  const tracking = openTrackingToken && clickTrackingToken
    ? buildTrackingUrls({
        appUrl,
        openTrackingToken,
        clickTrackingToken,
        driveFolderLink: project.driveFolderLink
      })
    : {
        openPixelUrl: null,
        trackedDriveUrl: project.driveFolderLink
      };

  const revisionLine = includeRevisionCta
    ? 'Need revisions, retouching adjustments, or alternate exports? Reply directly and our team will prioritize them.'
    : null;
  const feedbackLine = includeFeedbackCta
    ? 'We would also love to hear how the assets perform once they go live.'
    : null;
  const details = [
    `Project: ${project.title}`,
    `Project ID: ${project.projectCode}`,
    `Delivery link: ${project.driveFolderLink}`
  ];
  const detailsHtml = details
    .map((line) => `<div style="margin:0 0 8px;">${escapeHtml(line)}</div>`)
    .join('');
  const deliveryUrl = escapeHtml(tracking.trackedDriveUrl);
  const htmlParagraphs = [
    `<p style="margin:0 0 10px;color:${style.accentColor};font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;">${escapeHtml(preset.eyebrow)}</p>`,
    `<h1 style="margin:0 0 18px;color:${style.textColor};font-size:28px;line-height:1.15;font-weight:700;">${escapeHtml(preset.headline)}</h1>`,
    `<p style="margin:0 0 16px;color:${style.textColor};font-size:15px;line-height:1.7;">Hi ${escapeHtml(clientName)},</p>`,
    `<p style="margin:0 0 16px;color:${style.textColor};font-size:15px;line-height:1.7;">${escapeHtml(message)}</p>`,
    `<p style="margin:0 0 20px;color:${style.mutedColor};font-size:15px;line-height:1.7;">Your final delivery is ready to access in Google Drive.</p>`,
    `<p style="margin:0 0 24px;"><a href="${deliveryUrl}" style="display:inline-block;padding:13px 20px;border-radius:${style.buttonRadius};background:${style.buttonBackground};color:${style.buttonTextColor};text-decoration:none;font-weight:700;">${escapeHtml(preset.buttonLabel)}</a></p>`,
    `<div style="margin:0 0 18px;padding:16px 18px;border:1px solid ${style.cardBorder};border-radius:12px;background:${style.detailBackground};color:${style.mutedColor};font-size:13px;line-height:1.55;"><strong style="display:block;margin:0 0 10px;color:${style.textColor};">Project details</strong>${detailsHtml}</div>`,
    revisionLine ? `<p style="margin:0 0 12px;color:${style.textColor};font-size:14px;line-height:1.7;">${escapeHtml(revisionLine)}</p>` : '',
    feedbackLine ? `<p style="margin:0 0 12px;color:${style.textColor};font-size:14px;line-height:1.7;">${escapeHtml(feedbackLine)}</p>` : '',
    `<p style="margin:0 0 8px;color:${style.textColor};font-size:14px;line-height:1.7;">${escapeHtml(preset.closing)}</p>`,
    `<p style="margin:0;color:${style.textColor};font-size:14px;line-height:1.7;">${escapeHtml(preset.signoff)}<br />E-commerce Photography Studio</p>`,
    tracking.openPixelUrl ? `<img src="${tracking.openPixelUrl}" alt="" width="1" height="1" style="display:none;" />` : ''
  ].filter(Boolean);

  const html = [
    '<!doctype html>',
    '<html>',
    `<body style="margin:0;padding:24px;background:${style.bodyBackground};font-family:Arial,sans-serif;color:${style.textColor};">`,
    `<div data-template-tone="${selectedTone}" style="max-width:640px;margin:0 auto;background:${style.cardBackground};border:1px solid ${style.cardBorder};border-radius:${style.cardRadius};padding:32px;box-shadow:0 18px 50px rgba(15,23,42,0.08);">`,
    ...htmlParagraphs,
    '</div>',
    '</body>',
    '</html>'
  ].join('');

  const textLines = [
    preset.headline,
    '',
    `Hi ${clientName},`,
    '',
    message,
    '',
    'Your final delivery is ready in Google Drive.',
    ...details,
    '',
    revisionLine,
    feedbackLine,
    '',
    preset.closing,
    preset.signoff,
    'E-commerce Photography Studio'
  ].filter(Boolean);

  return {
    tone: selectedTone,
    subject,
    html,
    text: textLines.join('\n'),
    preview: {
      clientName,
      brandName
    }
  };
}
