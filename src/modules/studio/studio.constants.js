export const deliveryToneOptions = ['FORMAL', 'FRIENDLY', 'PREMIUM'];

export const studioProjectStatusOptions = ['EDITING', 'REVIEW', 'COMPLETED', 'HOLD'];

export const deliveryDispatchStatusOptions = ['PENDING', 'PROCESSING', 'RETRYABLE', 'SENT', 'FAILED', 'SKIPPED'];

export const emailLogStatusOptions = ['QUEUED', 'SENT', 'FAILED', 'OPENED', 'CLICKED'];

export const projectActivityTypeOptions = [
  'NOTE',
  'STATUS_UPDATED',
  'FOLLOW_UP_SENT',
  'DELIVERY_QUEUED',
  'DELIVERY_SENT',
  'DELIVERY_FAILED',
  'DEADLINE_EXTENDED'
];

export const openPixelBase64 = 'R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

export const deliveryTonePresets = {
  FORMAL: {
    label: 'Formal',
    subject: ({ brandName, projectCode }) => `${brandName} delivery package is ready${projectCode ? ` | ${projectCode}` : ''}`,
    eyebrow: 'Final Delivery',
    headline: 'Your project delivery package is ready',
    buttonLabel: 'Open Delivery Folder',
    intro: ({ brandName, title }) => `We are pleased to share that the final assets for ${brandName}'s ${title} project are ready for delivery.`,
    signoff: 'Kind regards,',
    closing: 'If you would like any revisions or have questions, simply reply to this email and our studio team will assist right away.',
    style: {
      bodyBackground: '#f6f8fb',
      cardBackground: '#ffffff',
      cardBorder: '#d8dee9',
      detailBackground: '#f8fafc',
      textColor: '#172033',
      mutedColor: '#5b677a',
      accentColor: '#14213d',
      buttonBackground: '#14213d',
      buttonTextColor: '#ffffff',
      buttonRadius: '6px',
      cardRadius: '14px'
    }
  },
  FRIENDLY: {
    label: 'Friendly',
    subject: ({ brandName, projectCode }) => `Your ${brandName} photos are ready${projectCode ? ` (${projectCode})` : ''}`,
    eyebrow: 'Photos Are Ready',
    headline: 'Your gallery is ready to enjoy',
    buttonLabel: 'Open Your Photos',
    intro: ({ brandName, title }) => `Great news. Your final selects for the ${brandName} ${title} shoot are uploaded and ready to review.`,
    signoff: 'Thanks again,',
    closing: 'If you would like any tweaks, feedback, or alternate exports, hit reply and we will take care of it.',
    style: {
      bodyBackground: '#fff7ed',
      cardBackground: '#fffaf4',
      cardBorder: '#f4c7ad',
      detailBackground: '#ffffff',
      textColor: '#271b14',
      mutedColor: '#7a5b49',
      accentColor: '#e76f51',
      buttonBackground: '#e76f51',
      buttonTextColor: '#ffffff',
      buttonRadius: '999px',
      cardRadius: '28px'
    }
  },
  PREMIUM: {
    label: 'Premium Client Tone',
    subject: ({ brandName, projectCode }) => `${brandName} final delivery is curated and ready${projectCode ? ` | ${projectCode}` : ''}`,
    eyebrow: 'Curated Studio Delivery',
    headline: 'Your final assets have been prepared',
    buttonLabel: 'View Curated Delivery',
    intro: ({ brandName, title }) => `Your studio delivery for ${brandName}'s ${title} campaign has been finalized and is now available in Google Drive.`,
    signoff: 'With appreciation,',
    closing: 'We would be delighted to hear your feedback, and we are available to coordinate revisions or additional rollout assets whenever needed.',
    style: {
      bodyBackground: '#111827',
      cardBackground: '#f8f4ea',
      cardBorder: '#d6c7a1',
      detailBackground: '#fffdf7',
      textColor: '#1a1f2b',
      mutedColor: '#665c49',
      accentColor: '#9f7a2f',
      buttonBackground: '#1a1f2b',
      buttonTextColor: '#f8f4ea',
      buttonRadius: '2px',
      cardRadius: '18px'
    }
  }
};
