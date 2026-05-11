import { processDeliveryQueue } from './src/modules/studio/studio.service.js';
import { prisma } from './src/config/prisma.js';

async function main() {
  console.log('Running processDeliveryQueue...');
  const res = await processDeliveryQueue();
  console.log('Result:', JSON.stringify(res, null, 2));

  const dispatches = await prisma.deliveryDispatch.findMany();
  console.log('Dispatches in DB:', JSON.stringify(dispatches, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
