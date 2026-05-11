import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const dispatches = await prisma.deliveryDispatch.findMany({ include: { project: true }, orderBy: { updatedAt: 'desc' } });
for (const d of dispatches) {
  const mins = d.lockedAt ? ((Date.now() - new Date(d.lockedAt).getTime()) / 60000).toFixed(1) : null;
  console.log(JSON.stringify({ code: d.project?.projectCode, status: d.status, attempts: d.attempts, maxAttempts: d.maxAttempts, lastError: d.lastError?.slice(0, 150), nextAttemptAt: d.nextAttemptAt, lockedMinsAgo: mins, sent: d.project?.deliveryEmailSent }));
}
await prisma.$disconnect();
