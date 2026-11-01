const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const targetUserIds = [
    'cmvx9er5700070mmc1ofh4529',
    'cmvxlexcf0000k1073amw2tu1',
    'cmvxmerso0000jj071r72lftp',
  ];

  const targetProductIds = [
    'cmvxn2dvq0001jt08u5c5qaz3',
  ];

  await prisma.user.deleteMany({
    where: { id: { in: targetUserIds } },
  });

  await prisma.product.deleteMany({
    where: { id: { in: targetProductIds } },
  });

  const remainingUsers = await prisma.user.findMany({
    where: { id: { in: targetUserIds } },
    select: { id: true, email: true, role: true },
  });

  const remainingProducts = await prisma.product.findMany({
    where: { id: { in: targetProductIds } },
    select: { id: true, name: true },
  });

  console.log('Remaining users:', JSON.stringify(remainingUsers, null, 2));
  console.log('Remaining products:', JSON.stringify(remainingProducts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
