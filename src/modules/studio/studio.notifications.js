import { env } from '../../config/env.js';
import { logger } from '../../logger.js';

async function sendWebhook(url, payload, channel) {
  if (!url) {
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text();
      logger.warn(`${channel} notification failed`, { body, status: response.status });
    }
  } catch (error) {
    logger.warn(`${channel} notification failed`, { error: error.message });
  }
}

export async function notifyDeliveryFailure({ project, errorMessage, attempts, finalFailure = false }) {
  const summary = `Delivery email failed for ${project.client.brandName} (${project.projectCode}) after attempt ${attempts}. ${errorMessage}`;

  await Promise.all([
    sendWebhook(env.SLACK_WEBHOOK_URL, {
      text: summary
    }, 'Slack'),
    sendWebhook(env.WHATSAPP_WEBHOOK_URL, {
      message: summary,
      projectCode: project.projectCode,
      brandName: project.client.brandName,
      finalFailure
    }, 'WhatsApp')
  ]);
}
