import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

try {
  const rows = await prisma.product.findMany({ take: 1 });
  console.log('count=' + rows.length);
  console.log(JSON.stringify(rows[0] || null));
} finally {
  await prisma.$disconnect();
}
