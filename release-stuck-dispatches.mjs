import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const staleCutoff = new Date(Date.now() - 2 * 60 * 1000);

  const result = await prisma.deliveryDispatch.updateMany({
    where: {
      status: 'PROCESSING',
      lockedAt: {
        lt: staleCutoff
      }
    },
    data: {
      status: 'RETRYABLE',
      lockedAt: null,
      lockedBy: null,
      lastError: 'Dispatch lock was stale and was released by maintenance script.',
      nextAttemptAt: new Date()
    }
  });

  console.log(`Released ${result.count} stale dispatch lock(s).`);
} finally {
  await prisma.$disconnect();
}
