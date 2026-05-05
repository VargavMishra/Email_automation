export const demoOverview = {
  totalClients: 124,
  activeProjects: 36,
  readyToDeliver: 8,
  sentDeliveries: 212,
  failedDispatches: 1,
  templatePresets: [
    { key: 'FORMAL', label: 'Formal' },
    { key: 'FRIENDLY', label: 'Friendly' },
    { key: 'PREMIUM', label: 'Premium Client Tone' }
  ]
};

export const demoProjects = [
  {
    id: 'studio-project-001',
    projectCode: 'APR-ACME-001',
    title: 'Summer collection hero set',
    status: 'COMPLETED',
    requiresFollowUp: false,
    deliveryEmailSent: false,
    deliveryTemplateTone: 'PREMIUM',
    driveFolderLink: 'https://drive.google.com/drive/folders/example',
    deadlineAt: '2026-04-28T10:00:00.000Z',
    client: {
      brandName: 'Acme Apparel',
      name: 'Nora Patel',
      email: 'nora@acme.example'
    },
    dispatch: {
      status: 'PENDING',
      nextAttemptAt: '2026-04-25T12:00:00.000Z'
    }
  },
  {
    id: 'studio-project-002',
    projectCode: 'APR-NOVA-004',
    title: 'Marketplace packshot refresh',
    status: 'COMPLETED',
    requiresFollowUp: true,
    followUpSentAt: '2026-04-24T11:45:00.000Z',
    deliveryEmailSent: true,
    deliveryTemplateTone: 'FORMAL',
    driveFolderLink: 'https://drive.google.com/drive/folders/example-2',
    deadlineAt: '2026-04-23T10:00:00.000Z',
    client: {
      brandName: 'Nova Home',
      name: 'Marco Lee',
      email: 'marco@nova.example'
    },
    dispatch: {
      status: 'SENT',
      sentAt: '2026-04-24T12:10:00.000Z'
    }
  }
];

export const demoLogs = [
  {
    id: 'log-1',
    status: 'SENT',
    recipientEmail: 'nora@acme.example',
    subject: 'Acme Apparel final delivery is curated and ready | APR-ACME-001',
    createdAt: '2026-04-25T11:03:00.000Z',
    openedAt: '2026-04-25T11:18:00.000Z',
    project: {
      projectCode: 'APR-ACME-001',
      client: {
        brandName: 'Acme Apparel'
      }
    }
  },
  {
    id: 'log-2',
    status: 'FAILED',
    recipientEmail: 'ops@northshore.example',
    subject: 'Northshore delivery package is ready | APR-NS-008',
    createdAt: '2026-04-25T08:40:00.000Z',
    errorMessage: 'SMTP timeout while waiting for upstream server acknowledgement.',
    project: {
      projectCode: 'APR-NS-008',
      client: {
        brandName: 'Northshore'
      }
    }
  }
];
