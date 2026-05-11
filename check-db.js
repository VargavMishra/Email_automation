import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const dispatches = await prisma.deliveryDispatch.findMany({
    include: { project: true }
  });
  console.log(JSON.stringify(dispatches, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
