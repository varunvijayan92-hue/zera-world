import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const names = ["Home", "Wellness", "Kitchen", "Travel", "Workspace", "Gift Edit", "New In"];
const slug = (name) => name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

try {
  const categoriesExist = await prisma.storeCategory.count();
  if (!categoriesExist) {
    for (const [sortOrder, name] of names.entries()) await prisma.storeCategory.create({ data: { name, slug: slug(name), sortOrder } });
    console.log("Created the seven starting menu categories.");
  } else console.log("Existing menu categories preserved.");
  const legacy = await prisma.product.findMany({ where: { categoryId: null, category: { not: null } }, distinct: ["category"], select: { category: true } });
  for (const { category: name } of legacy) {
    if (!name?.trim()) continue;
    const category = await prisma.storeCategory.upsert({ where: { slug: slug(name) || "uncategorized" }, create: { name, slug: slug(name) || "uncategorized", sortOrder: await prisma.storeCategory.count() }, update: {} });
    await prisma.product.updateMany({ where: { categoryId: null, category: { equals: name, mode: "insensitive" } }, data: { categoryId: category.id, category: category.name } });
  }
} catch (error) { console.error("Category setup failed:", error.code || error.name); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
