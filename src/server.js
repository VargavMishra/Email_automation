import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './config/prisma.js';
import { logger } from './logger.js';
import { startStudioAutomationEngine, stopStudioAutomationEngine } from './modules/studio/studio.automation.js';
import 'dotenv/config';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`Photo studio automation API listening on port ${env.PORT}`);
  startStudioAutomationEngine();
});

async function shutdown(signal) {
  logger.info(`Received ${signal}; shutting down.`);
  server.close(async () => {
    stopStudioAutomationEngine();
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
