import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const loginId = "admin";
  const password = "admin@123";

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email: loginId }, { fullName: "System Administrator" }],
    },
  });

  if (existing) {
    console.log(`Default admin already exists: ${existing.email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email: loginId,
      passwordHash,
      fullName: "System Administrator",
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Default admin created: ${user.email} / ${password}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
