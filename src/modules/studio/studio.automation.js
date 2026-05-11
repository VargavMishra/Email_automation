import { env } from '../../config/env.js';
import { logger } from '../../logger.js';
import { processDeliveryQueue, reconcileEligibleProjects } from './studio.service.js';

let reconcileTimer = null;
let workerTimer = null;
let reconcileRunning = false;
let workerRunning = false;

async function runReconcile() {
  if (reconcileRunning) {
    return;
  }

  reconcileRunning = true;

  try {
    const result = await reconcileEligibleProjects();
    logger.info('Studio reconcile cycle completed', { queued: result.length });
  } catch (error) {
    logger.error('Studio reconcile cycle failed', { error: error.message });
  } finally {
    reconcileRunning = false;
  }
}

async function runWorker() {
  if (workerRunning) {
    return;
  }

  workerRunning = true;

  try {
    const result = await processDeliveryQueue();
    logger.info('Studio worker cycle completed', { processed: result.length });
  } catch (error) {
    logger.error('Studio worker cycle failed', { error: error.message });
  } finally {
    workerRunning = false;
  }
}

export function startStudioAutomationEngine() {
  if (!env.STUDIO_AUTOMATION_ENABLED || env.NODE_ENV === 'test') {
    return;
  }

  if (reconcileTimer || workerTimer) {
    return;
  }

  runReconcile();
  runWorker();

  reconcileTimer = setInterval(runReconcile, env.STUDIO_RECONCILE_INTERVAL_MS);
  workerTimer = setInterval(runWorker, env.STUDIO_WORKER_INTERVAL_MS);

  logger.info('Studio automation engine started', {
    reconcileIntervalMs: env.STUDIO_RECONCILE_INTERVAL_MS,
    workerIntervalMs: env.STUDIO_WORKER_INTERVAL_MS
  });
}

export function stopStudioAutomationEngine() {
  if (reconcileTimer) {
    clearInterval(reconcileTimer);
    reconcileTimer = null;
  }

  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
  }
}
