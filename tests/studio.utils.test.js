import { computeBackoffDelayMs, getDeliveryEligibility, renderDeliveryTemplate } from '../src/modules/studio/studio.utils.js';

describe('studio delivery eligibility', () => {
  it('marks completed projects without client check-in requirements as eligible', () => {
    const eligibility = getDeliveryEligibility({
      status: 'COMPLETED',
      requiresFollowUp: false,
      followUpSentAt: null,
      deliveryEmailSent: false,
      driveFolderLink: 'https://drive.google.com/drive/folders/example'
    });

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.reasons).toHaveLength(0);
  });

  it('blocks delivery when client check-in is required and missing', () => {
    const eligibility = getDeliveryEligibility({
      status: 'COMPLETED',
      requiresFollowUp: true,
      followUpSentAt: null,
      deliveryEmailSent: false,
      driveFolderLink: 'https://drive.google.com/drive/folders/example'
    });

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.reasons[0]).toMatch(/Client check-in/i);
  });
});

describe('studio delivery template rendering', () => {
  it('renders tracking links and personalized content', () => {
    const template = renderDeliveryTemplate({
      project: {
        title: 'Hero campaign',
        projectCode: 'APR-001',
        driveFolderLink: 'https://drive.google.com/drive/folders/example',
        deliveryTemplateTone: 'PREMIUM',
        client: {
          name: 'Nora',
          brandName: 'Acme Apparel'
        }
      },
      appUrl: 'https://studio.example.com',
      openTrackingToken: 'open-token',
      clickTrackingToken: 'click-token'
    });

    expect(template.subject).toMatch(/Acme Apparel/i);
    expect(template.html).toContain('/api/studio/tracking/open/open-token');
    expect(template.html).toContain('/api/studio/tracking/click/click-token');
    expect(template.text).toContain('Hero campaign');
  });

  it('uses direct Drive links when the app URL is localhost', () => {
    const template = renderDeliveryTemplate({
      project: {
        title: 'Hero campaign',
        projectCode: 'APR-001',
        driveFolderLink: 'https://drive.google.com/drive/folders/example',
        deliveryTemplateTone: 'PREMIUM',
        client: {
          name: 'Nora',
          brandName: 'Acme Apparel'
        }
      },
      appUrl: 'http://localhost:4500',
      openTrackingToken: 'open-token',
      clickTrackingToken: 'click-token'
    });

    expect(template.html).not.toContain('/api/studio/tracking/click/click-token');
    expect(template.html).toContain('https://drive.google.com/drive/folders/example');
  });

  it('renders distinct formats for each delivery tone', () => {
    const project = {
      title: 'Hero campaign',
      projectCode: 'APR-001',
      driveFolderLink: 'https://drive.google.com/drive/folders/example',
      client: {
        name: 'Nora',
        brandName: 'Acme Apparel'
      }
    };
    const formal = renderDeliveryTemplate({ project, tone: 'FORMAL', appUrl: 'https://studio.example.com' });
    const friendly = renderDeliveryTemplate({ project, tone: 'FRIENDLY', appUrl: 'https://studio.example.com' });
    const premium = renderDeliveryTemplate({ project, tone: 'PREMIUM', appUrl: 'https://studio.example.com' });

    expect(new Set([formal.subject, friendly.subject, premium.subject]).size).toBe(3);
    expect(formal.html).toContain('data-template-tone="FORMAL"');
    expect(friendly.html).toContain('data-template-tone="FRIENDLY"');
    expect(premium.html).toContain('data-template-tone="PREMIUM"');
    expect(formal.html).toContain('Open Delivery Folder');
    expect(friendly.html).toContain('Open Your Photos');
    expect(premium.html).toContain('View Curated Delivery');
    expect(new Set([formal.html, friendly.html, premium.html]).size).toBe(3);
  });

  it('uses exponential backoff for retries', () => {
    expect(computeBackoffDelayMs(1, 1000)).toBe(1000);
    expect(computeBackoffDelayMs(2, 1000)).toBe(2000);
    expect(computeBackoffDelayMs(3, 1000)).toBe(4000);
  });
});
