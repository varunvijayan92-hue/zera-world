import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
try {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error("Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in the local environment first.");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!process.argv.includes("--reset-password")) console.log("This admin account already exists. Its password was left unchanged.");
    else {
      if (existing.role !== "ADMIN") throw new Error("The existing account is not an admin; choose the intended admin account.");
      await prisma.user.update({ where: { id: existing.id }, data: { passwordHash: await bcrypt.hash(password, 12), isActive: true } });
      console.log("Admin password updated.");
    }
  } else {
    await prisma.user.create({ data: { email, fullName: "Store Administrator", role: "ADMIN", isActive: true, passwordHash: await bcrypt.hash(password, 12) } });
    console.log("Admin account created. Sign in at /admin/login using the configured credentials.");
  }
} catch (error) { console.error(error instanceof Error ? error.message : "Admin setup failed."); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
