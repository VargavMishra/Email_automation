import { prisma } from './src/config/prisma.js';
import { processDeliveryQueue } from './src/modules/studio/studio.service.js';

async function main() {
  console.log('Connecting to Prisma...');
  await prisma.$connect();
  console.log('Connected.');
  console.log('Running processDeliveryQueue...');
  const res = await processDeliveryQueue();
  console.log('Result:', res);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
