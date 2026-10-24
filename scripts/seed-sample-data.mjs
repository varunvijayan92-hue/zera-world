import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existingSuppliers = await prisma.supplier.count();

  if (existingSuppliers > 0) {
    console.log("Sample supplier data already exists.");
    return;
  }

  const supplierA = await prisma.supplier.create({
    data: {
      companyName: "Northline Goods",
      contactName: "Asha Mehta",
      email: "asha@northlinegoods.com",
      phone: "+91 99887 22331",
      website: "https://northlinegoods.example",
      status: "ACTIVE",
      taxId: "GST-09NGL001",
      businessType: "Wholesale",
      returnPolicy: "30-day replacement for manufacturing defects",
      paymentTerms: "Net 15",
      minOrderQty: 25,
      leadTimeDays: 6,
      shippingCharges: 180,
      notes: "Fast dispatch, preferred partner",
    },
  });

  const supplierB = await prisma.supplier.create({
    data: {
      companyName: "Urban Canvas",
      contactName: "Ravi Sethi",
      email: "ravi@urbancanvas.in",
      phone: "+91 98111 45123",
      website: "https://urbancanvas.example",
      status: "ACTIVE",
      taxId: "GST-22UCB112",
      businessType: "Private label",
      returnPolicy: "Replacement within 15 days",
      paymentTerms: "Net 30",
      minOrderQty: 50,
      leadTimeDays: 9,
      shippingCharges: 220,
      notes: "Handles premium lifestyle products",
    },
  });

  const productA = await prisma.product.create({
    data: {
      name: "AeroDesk Lamp",
      sku: "ADE-001",
      barcode: "890123456001",
      description: "Minimal desk lamp with adjustable angle and USB-C power",
      category: "Home Office",
      brand: "AeroDesk",
      status: "ACTIVE",
      costPrice: 990,
      sellingPrice: 1799,
      dimensions: "24 x 14 x 30 cm",
      weightKg: 0.8,
      taxClassification: "GST-18",
      imageUrls: ["https://images.example/lamp-1.jpg"],
      supplierId: supplierA.id,
    },
  });

  const productB = await prisma.product.create({
    data: {
      name: "DailyCarry Tote",
      sku: "DCT-022",
      barcode: "890123456022",
      description: "Water resistant canvas tote with internal organiser",
      category: "Accessories",
      brand: "CarryDaily",
      status: "ACTIVE",
      costPrice: 650,
      sellingPrice: 1299,
      dimensions: "38 x 28 x 16 cm",
      weightKg: 0.55,
      taxClassification: "GST-12",
      imageUrls: ["https://images.example/tote-1.jpg"],
      supplierId: supplierB.id,
    },
  });

  await prisma.supplierProduct.createMany({
    data: [
      {
        supplierId: supplierA.id,
        productId: productA.id,
        supplierProductCode: "NLG-ADE-001",
        supplierSku: "NLG-001",
        purchasePrice: 990,
        minimumOrderQuantity: 25,
        dispatchTimeDays: 6,
        shippingCharges: 180,
        isPreferred: true,
      },
      {
        supplierId: supplierB.id,
        productId: productB.id,
        supplierProductCode: "UC-DCT-022",
        supplierSku: "UC-022",
        purchasePrice: 650,
        minimumOrderQuantity: 50,
        dispatchTimeDays: 9,
        shippingCharges: 220,
        isPreferred: true,
      },
    ],
  });

  await prisma.warehouse.create({
    data: {
      name: "Primary Warehouse",
      code: "WH-01",
      address: "Bengaluru, India",
      isDefault: true,
    },
  });

  await prisma.inventory.createMany({
    data: [
      {
        productId: productA.id,
        warehouseId: (await prisma.warehouse.findFirst({ where: { code: "WH-01" } }))?.id,
        supplierId: supplierA.id,
        availableQty: 144,
        reservedQty: 22,
        damagedQty: 4,
        incomingQty: 50,
        safetyStock: 30,
        status: "AVAILABLE",
      },
      {
        productId: productB.id,
        warehouseId: (await prisma.warehouse.findFirst({ where: { code: "WH-01" } }))?.id,
        supplierId: supplierB.id,
        availableQty: 96,
        reservedQty: 18,
        damagedQty: 2,
        incomingQty: 30,
        safetyStock: 20,
        status: "AVAILABLE",
      },
    ],
  });

  console.log("Sample supplier and product data created successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
