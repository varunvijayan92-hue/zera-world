import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { GET as getNavigation } from "../app/api/mobile/navigation/route";
import { GET as getSupplierSection } from "../app/api/mobile/supplier/[section]/route";
import { GET as getAdminSection } from "../app/api/mobile/admin/[section]/route";
import { POST as postAdminAction } from "../app/api/mobile/admin/actions/route";
import { POST as postSupplierAction } from "../app/api/supplier/actions/route";
import { POST as postMobileUpload } from "../app/api/mobile/upload/route";
import { cloudinaryMedia } from "../lib/cloudinary";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";

test("mobile navigation rejects unauthenticated requests with 401", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => null);

  const response = await getNavigation();
  assert.equal(response.status, 401);
  const json = await response.json();
  assert.equal(json.message, "Sign in required.");
});

test("mobile navigation rejects non-portal roles (e.g. CUSTOMER) with 403", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "cust-1",
    role: "CUSTOMER",
    email: "customer@test.local",
    fullName: "Customer Test",
    isActive: true,
  }));

  const response = await getNavigation();
  assert.equal(response.status, 403);
  const json = await response.json();
  assert.equal(json.message, "Portal access required.");
});

test("mobile navigation returns admin groups for ADMIN user", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  const response = await getNavigation();
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.role, "ADMIN");
  assert.ok(Array.isArray(json.groups));
  assert.ok(json.groups.length > 0);
  assert.ok(json.groups[0].items.length > 0);
  assert.ok(typeof json.groups[0].items[0].id === "string");
  assert.ok(typeof json.groups[0].items[0].label === "string");
});

test("mobile navigation returns supplier groups for active SUPPLIER user", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "supp-user-1",
    role: "SUPPLIER",
    email: "supplier@test.local",
    fullName: "Supplier User",
    isActive: true,
  }));

  const originalSupplierContact = prisma.supplierContact;
  Object.assign(prisma, {
    supplierContact: {
      findFirst: async () => ({
        id: "contact-1",
        supplier: { id: "supp-1", companyName: "Supplier Co", status: "ACTIVE", sourceType: "DIRECT" },
      }),
    },
  });
  t.after(() => Object.assign(prisma, { supplierContact: originalSupplierContact }));

  const response = await getNavigation();
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.equal(json.role, "SUPPLIER");
  assert.ok(Array.isArray(json.groups));
  assert.ok(json.groups.some((g: { label: string }) => g.label === "Overview"));
  assert.ok(json.groups.some((g: { label: string }) => g.label === "Fulfilment"));
});

test("mobile supplier section rejects non-supplier with 403", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  const request = new Request("http://localhost/api/mobile/supplier/dashboard");
  const response = await getSupplierSection(request, { params: Promise.resolve({ section: "dashboard" }) });
  assert.equal(response.status, 403);
});

test("mobile supplier section rejects unknown section with 404", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "supp-user-1",
    role: "SUPPLIER",
    email: "supplier@test.local",
    fullName: "Supplier User",
    isActive: true,
  }));

  const originalSupplierContact = prisma.supplierContact;
  Object.assign(prisma, {
    supplierContact: {
      findFirst: async () => ({
        id: "contact-1",
        supplier: { id: "supp-1", status: "ACTIVE", sourceType: "DIRECT" },
      }),
    },
  });
  t.after(() => Object.assign(prisma, { supplierContact: originalSupplierContact }));

  const request = new Request("http://localhost/api/mobile/supplier/nonexistent");
  const response = await getSupplierSection(request, { params: Promise.resolve({ section: "nonexistent" }) });
  assert.equal(response.status, 404);
  const json = await response.json();
  assert.equal(json.message, "Unknown supplier section.");
});

test("mobile supplier section scopes dashboard queries to supplierId", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "supp-user-1",
    role: "SUPPLIER",
    email: "supplier@test.local",
    fullName: "Supplier User",
    isActive: true,
  }));

  const queriedWhere: Record<string, unknown>[] = [];
  const originalPrisma = {
    supplierContact: prisma.supplierContact,
    orderItem: prisma.orderItem,
    product: prisma.product,
    shipment: prisma.shipment,
    returnRequest: prisma.returnRequest,
  };

  Object.assign(prisma, {
    supplierContact: {
      findFirst: async () => ({
        id: "contact-1",
        supplier: { id: "supp-99", status: "ACTIVE", sourceType: "DIRECT" },
      }),
    },
    orderItem: {
      count: async ({ where }: { where: unknown }) => {
        queriedWhere.push({ orderItem: where });
        return 12;
      },
    },
    product: {
      count: async ({ where }: { where: unknown }) => {
        queriedWhere.push({ product: where });
        return 5;
      },
    },
    shipment: {
      count: async ({ where }: { where: unknown }) => {
        queriedWhere.push({ shipment: where });
        return 3;
      },
    },
    returnRequest: {
      count: async ({ where }: { where: unknown }) => {
        queriedWhere.push({ returnRequest: where });
        return 1;
      },
    },
  });
  t.after(() => Object.assign(prisma, originalPrisma));

  const request = new Request("http://localhost/api/mobile/supplier/dashboard");
  const response = await getSupplierSection(request, { params: Promise.resolve({ section: "dashboard" }) });
  assert.equal(response.status, 200);
  const json = await response.json();
  assert.deepEqual(json.data, {
    orderLines: 12,
    products: 5,
    shipments: 3,
    returns: 1,
  });

  // Verify all queries were scoped to supp-99
  assert.equal(queriedWhere.length, 4);
  assert.deepEqual(queriedWhere[0], { orderItem: { supplierId: "supp-99" } });
  assert.deepEqual(queriedWhere[1], { product: { supplierId: "supp-99" } });
  assert.deepEqual(queriedWhere[2], { shipment: { supplierId: "supp-99" } });
  assert.deepEqual(queriedWhere[3], { returnRequest: { supplierId: "supp-99" } });
});

test("mobile supplier section reads profile data securely", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "supp-user-1",
    role: "SUPPLIER",
    email: "supplier@test.local",
    fullName: "Supplier User",
    isActive: true,
  }));

  const mockSupplier = {
    id: "supp-10",
    companyName: "Acme Supplies",
    contactName: "John Doe",
    phone: "9876543210",
    pickupAddress: "123 Main St",
    pickupCity: "Mumbai",
    pickupState: "Maharashtra",
    pickupPincode: "400001",
    companyEmail: "info@acme.com",
    companyPhone: "9876543210",
    companyAddress: "Headquarters",
    gstNumber: "27AAAAA0000A1Z5",
    companyRegistrationNumber: "REG123",
    companyLicenseNumber: "LIC456",
    companyProfileNotes: "Specialist in apparel",
    status: "ACTIVE",
    sourceType: "DIRECT",
  };

  const originalSupplierContact = prisma.supplierContact;
  Object.assign(prisma, {
    supplierContact: {
      findFirst: async () => ({
        id: "contact-1",
        supplier: mockSupplier,
      }),
    },
  });
  t.after(() => Object.assign(prisma, { supplierContact: originalSupplierContact }));

  const reqProfile = new Request("http://localhost/api/mobile/supplier/profile");
  const resProfile = await getSupplierSection(reqProfile, { params: Promise.resolve({ section: "profile" }) });
  assert.equal(resProfile.status, 200);
  const jsonProfile = await resProfile.json();
  assert.deepEqual(jsonProfile.data, {
    companyName: "Acme Supplies",
    contactName: "John Doe",
    phone: "9876543210",
  });

  const reqPickup = new Request("http://localhost/api/mobile/supplier/pickup-address");
  const resPickup = await getSupplierSection(reqPickup, { params: Promise.resolve({ section: "pickup-address" }) });
  assert.equal(resPickup.status, 200);
  const jsonPickup = await resPickup.json();
  assert.deepEqual(jsonPickup.data, {
    pickupAddress: "123 Main St",
    pickupCity: "Mumbai",
    pickupState: "Maharashtra",
    pickupPincode: "400001",
    contactName: "John Doe",
    phone: "9876543210",
  });
});

test("mobile admin section rejects unauthenticated with 401", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => null);
  const req = new Request("http://localhost/api/mobile/admin/dashboard");
  const res = await getAdminSection(req, { params: Promise.resolve({ section: "dashboard" }) });
  assert.equal(res.status, 401);
});

test("mobile admin section rejects non-admin roles (e.g. SUPPLIER, CUSTOMER) with 403", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "supp-1",
    role: "SUPPLIER",
    email: "supp@test.local",
    fullName: "Supplier User",
    isActive: true,
  }));
  const req = new Request("http://localhost/api/mobile/admin/dashboard");
  const res = await getAdminSection(req, { params: Promise.resolve({ section: "dashboard" }) });
  assert.equal(res.status, 403);
});

test("mobile admin section provides dashboard metrics for ADMIN", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  const originalPrisma = {
    customerOrder: prisma.customerOrder,
    product: prisma.product,
    user: prisma.user,
    supplier: prisma.supplier,
    shipment: prisma.shipment,
    returnRequest: prisma.returnRequest,
  };

  Object.assign(prisma, {
    customerOrder: { count: async () => 42 },
    product: { count: async () => 150 },
    user: { count: async () => 200 },
    supplier: { count: async () => 8 },
    shipment: { count: async () => 35 },
    returnRequest: { count: async () => 4 },
  });
  t.after(() => Object.assign(prisma, originalPrisma));

  const req = new Request("http://localhost/api/mobile/admin/dashboard");
  const res = await getAdminSection(req, { params: Promise.resolve({ section: "dashboard" }) });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.deepEqual(json.data, {
    ordersCount: 42,
    productsCount: 150,
    customersCount: 200,
    suppliersCount: 8,
    shipmentsCount: 35,
    returnsCount: 4,
  });
});

test("mobile admin section rejects unknown section with 404", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));
  const req = new Request("http://localhost/api/mobile/admin/unknown-sec");
  const res = await getAdminSection(req, { params: Promise.resolve({ section: "unknown-sec" }) });
  assert.equal(res.status, 404);
});

test("mobile admin action allows updating product status", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  let updatedStatus = "";
  const txMock = {
    product: {
      findUnique: async () => ({ id: "prod-1", status: "DRAFT" }),
      update: async ({ data }: { data: { status: string } }) => {
        updatedStatus = data.status;
        return { id: "prod-1", status: data.status };
      },
    },
    auditLog: {
      create: async () => ({ id: "log-1" }),
    },
  };

  const originalTx = prisma.$transaction;
  // @ts-expect-error Mock transaction
  prisma.$transaction = async (cb: (tx: typeof txMock) => unknown) => cb(txMock);
  t.after(() => { prisma.$transaction = originalTx; });

  const req = new Request("http://localhost/api/mobile/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "PRODUCT_STATUS",
      productId: "prod-1",
      status: "ACTIVE",
    }),
  });

  const res = await postAdminAction(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(updatedStatus, "ACTIVE");
});

test("mobile admin action allows reviewing return requests", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  let reviewedStatus = "";
  const txMock = {
    returnRequest: {
      findUnique: async () => ({ id: "ret-1", status: "OPEN" }),
      update: async ({ data }: { data: { status: string } }) => {
        reviewedStatus = data.status;
        return { id: "ret-1", status: data.status };
      },
    },
    auditLog: {
      create: async () => ({ id: "log-1" }),
    },
  };

  const originalTx = prisma.$transaction;
  // @ts-expect-error Mock transaction
  prisma.$transaction = async (cb: (tx: typeof txMock) => unknown) => cb(txMock);
  t.after(() => { prisma.$transaction = originalTx; });

  const req = new Request("http://localhost/api/mobile/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "RETURN_REVIEW",
      returnId: "ret-1",
      decision: "APPROVED",
      notes: "Valid damage claim",
    }),
  });

  const res = await postAdminAction(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(reviewedStatus, "APPROVED");
});

test("mobile supplier action allows order fulfillment update", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "supp-user-1",
    role: "SUPPLIER",
    email: "supplier@test.local",
    fullName: "Supplier User",
    isActive: true,
  }));

  const originalSupplierContact = prisma.supplierContact;
  Object.assign(prisma, {
    supplierContact: {
      findFirst: async () => ({
        id: "contact-1",
        supplier: { id: "supp-1", status: "ACTIVE", sourceType: "DIRECT" },
      }),
    },
  });
  t.after(() => Object.assign(prisma, { supplierContact: originalSupplierContact }));

  let itemUpdatedStatus = "";
  const txMock = {
    orderItem: {
      findFirst: async () => ({
        id: "item-1",
        customerOrderId: "order-1",
        supplierId: "supp-1",
        fulfillmentStatus: "PENDING",
        customerOrder: { id: "order-1", status: "CONFIRMED" },
      }),
      update: async ({ data }: { data: { fulfillmentStatus: string } }) => {
        itemUpdatedStatus = data.fulfillmentStatus;
        return { id: "item-1" };
      },
    },
    paymentTransaction: {
      findFirst: async () => ({ id: "pay-1", paymentStatus: "PAID" }),
    },
    auditLog: {
      create: async () => ({ id: "log-1" }),
    },
  };

  const originalTx = prisma.$transaction;
  // @ts-expect-error Mock transaction
  prisma.$transaction = async (cb: (tx: typeof txMock) => unknown) => cb(txMock);
  t.after(() => { prisma.$transaction = originalTx; });

  const req = new Request("http://localhost/api/supplier/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "ORDER",
      itemId: "item-1",
      status: "ACCEPTED",
    }),
  });

  const res = await postSupplierAction(req);
  assert.equal(res.status, 200);
  assert.equal(itemUpdatedStatus, "ACCEPTED");
});

test("mobile admin action allows creating a product", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  let createdName = "";
  const txMock = {
    product: {
      findUnique: async () => null,
      create: async ({ data }: { data: { name: string; sku: string } }) => {
        createdName = data.name;
        return { id: "prod-new", name: data.name, sku: data.sku };
      },
    },
    auditLog: {
      create: async () => ({ id: "log-1" }),
    },
  };

  const originalTx = prisma.$transaction;
  // @ts-expect-error Mock transaction
  prisma.$transaction = async (cb: (tx: typeof txMock) => unknown) => cb(txMock);
  t.after(() => { prisma.$transaction = originalTx; });

  const req = new Request("http://localhost/api/mobile/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "PRODUCT_CREATE",
      name: "Smart Watch Elite",
      sku: "SW-ELITE-01",
      category: "Electronics",
      sellingPrice: 1999,
      costPrice: 999,
      stock: 50,
      description: "Premium smartwatch",
    }),
  });

  const res = await postAdminAction(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(createdName, "Smart Watch Elite");
});

test("mobile admin action allows creating a supplier and recording settlement", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  let createdSupplier = "";
  let settlementAmt = 0;
  const txMock = {
    supplier: {
      findUnique: async () => ({ id: "supp-10", companyName: "Nexus Exports" }),
      create: async ({ data }: { data: { companyName: string } }) => {
        createdSupplier = data.companyName;
        return { id: "supp-10", companyName: data.companyName };
      },
    },
    supplierSettlement: {
      create: async ({ data }: { data: { amount: number } }) => {
        settlementAmt = data.amount;
        return { id: "set-1" };
      },
    },
    auditLog: {
      create: async () => ({ id: "log-1" }),
    },
  };

  const originalTx = prisma.$transaction;
  // @ts-expect-error Mock transaction
  prisma.$transaction = async (cb: (tx: typeof txMock) => unknown) => cb(txMock);
  t.after(() => { prisma.$transaction = originalTx; });

  // Test Supplier Create
  const reqCreate = new Request("http://localhost/api/mobile/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "SUPPLIER_CREATE",
      companyName: "Nexus Exports",
      contactName: "Raj Sharma",
      email: "raj@nexusexports.test",
      phone: "9876543210",
      sourceType: "DIRECT",
    }),
  });
  const resCreate = await postAdminAction(reqCreate);
  assert.equal(resCreate.status, 200);
  assert.equal(createdSupplier, "Nexus Exports");

  // Test Supplier Settlement
  const reqSettle = new Request("http://localhost/api/mobile/admin/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "SUPPLIER_SETTLEMENT",
      supplierId: "supp-10",
      amount: 45000,
      reference: "NEFT-2026-9999",
      notes: "Settlement for batch 12",
    }),
  });
  const resSettle = await postAdminAction(reqSettle);
  assert.equal(resSettle.status, 200);
  assert.equal(settlementAmt, 45000);
});

test("mobile admin accounts and profit-expenses return profitAndLoss statement", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin Test",
    isActive: true,
  }));

  const originalPrisma = {
    customerOrder: prisma.customerOrder,
    expense: prisma.expense,
    returnRequest: prisma.returnRequest,
    refund: prisma.refund,
    paymentTransaction: prisma.paymentTransaction,
  };

  Object.assign(prisma, {
    customerOrder: {
      findMany: async () => [
        {
          id: "ord-1",
          totalAmount: 5000,
          taxAmount: 250,
          handlingAmount: 50,
          subtotal: 4600,
          shippingAmount: 100,
          orderItems: [{ quantity: 2, costPrice: 1200 }],
          shipments: [{ shipmentCost: 80 }],
        },
      ],
    },
    expense: {
      findMany: async () => [
        { id: "exp-1", category: "Hosting", description: "Vercel", amount: 1500, currency: "INR", expenseDate: new Date() },
      ],
    },
    returnRequest: { findMany: async () => [] },
    refund: { findMany: async () => [] },
    paymentTransaction: {
      findMany: async () => [
        { id: "pay-1", orderId: "ord-1", paymentStatus: "PAID", amount: 5000, provider: "RAZORPAY", currency: "INR", createdAt: new Date() },
      ],
    },
  });
  t.after(() => Object.assign(prisma, originalPrisma));

  // Test Accounts section
  const reqAcc = new Request("http://localhost/api/mobile/admin/accounts");
  const resAcc = await getAdminSection(reqAcc, { params: Promise.resolve({ section: "accounts" }) });
  assert.equal(resAcc.status, 200);
  const jsonAcc = await resAcc.json();
  assert.ok(jsonAcc.data.profitAndLoss);
  assert.equal(typeof jsonAcc.data.profitAndLoss.grossRevenue, "number");
  assert.equal(typeof jsonAcc.data.profitAndLoss.netProfitOrLoss, "number");
  assert.ok(Array.isArray(jsonAcc.data.transactions));

  // Test Profit-Expenses section
  const reqProf = new Request("http://localhost/api/mobile/admin/profit-expenses");
  const resProf = await getAdminSection(reqProf, { params: Promise.resolve({ section: "profit-expenses" }) });
  assert.equal(resProf.status, 200);
  const jsonProf = await resProf.json();
  assert.ok(jsonProf.data.profitAndLoss);
  assert.ok(Array.isArray(jsonProf.data.expenses));
});

test("mobile upload rejects unauthenticated with 401", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => null);
  const req = new Request("http://localhost/api/mobile/upload", { method: "POST" });
  const res = await postMobileUpload(req);
  assert.equal(res.status, 401);
});

test("mobile upload rejects non-multipart with 400", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin User",
    isActive: true,
  }));
  const req = new Request("http://localhost/api/mobile/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const res = await postMobileUpload(req);
  assert.equal(res.status, 400);
});

test("mobile upload links photo to product in database", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin User",
    isActive: true,
  }));

  const originalCloudinary = cloudinaryMedia.upload;
  (cloudinaryMedia as any).upload = async () => ({
    url: "https://res.cloudinary.com/test/image/upload/v1234/test.webp",
    publicId: "zeraworld/products/prod-1/test",
  });
  t.after(() => { (cloudinaryMedia as any).upload = originalCloudinary; });

  let updatedProductUrls: string[] = [];
  const originalPrisma = {
    product: prisma.product,
    $transaction: prisma.$transaction,
  };

  Object.assign(prisma, {
    product: {
      findUnique: async () => ({
        id: "prod-1",
        supplierId: null,
        imageUrls: ["https://example.com/existing.jpg"],
      }),
      update: async ({ data }: any) => {
        updatedProductUrls = data.imageUrls;
        return { id: "prod-1", imageUrls: data.imageUrls };
      },
    },
    $transaction: async (cb: any) => cb({
      product: {
        findUnique: async () => ({ id: "prod-1", imageUrls: ["https://example.com/existing.jpg"] }),
        update: async ({ data }: any) => {
          updatedProductUrls = data.imageUrls;
          return { id: "prod-1", imageUrls: data.imageUrls };
        },
      },
    }),
  });
  t.after(() => Object.assign(prisma, originalPrisma));

  // Build a minimal valid JPEG buffer (starts with 0xFF, 0xD8, 0xFF)
  const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const file = new File([jpegBytes], "test.jpg", { type: "image/jpeg" });

  const form = new FormData();
  form.append("file", file);
  form.append("productId", "prod-1");
  form.append("kind", "products");

  const req = new Request("http://localhost/api/mobile/upload", {
    method: "POST",
    body: form,
  });

  const res = await postMobileUpload(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.success, true);
  assert.equal(json.url, "https://res.cloudinary.com/test/image/upload/v1234/test.webp");
  assert.deepEqual(updatedProductUrls, [
    "https://example.com/existing.jpg",
    "https://res.cloudinary.com/test/image/upload/v1234/test.webp",
  ]);
});

test("mobile admin action allows creating categories and updating inventory", async (t: TestContext) => {
  t.mock.method(authContext, "current", async () => ({
    id: "admin-1",
    role: "ADMIN",
    email: "admin@test.local",
    fullName: "Admin User",
    isActive: true,
  }));

  let createdCategory: any = null;
  let updatedInventory: any = null;

  const originalPrisma = {
    storeCategory: prisma.storeCategory,
    product: prisma.product,
    inventory: prisma.inventory,
    auditLog: prisma.auditLog,
    $transaction: prisma.$transaction,
  };

  const fakeTx = {
    storeCategory: {
      findFirst: async () => null,
      create: async ({ data }: any) => {
        createdCategory = data;
        return { id: "cat-1", name: data.name, slug: data.slug };
      },
    },
    product: {
      findUnique: async () => ({ id: "prod-1", name: "T-Shirt", supplierId: null, inventory: [{ id: "inv-1", availableQty: 10 }] }),
    },
    inventory: {
      update: async ({ data }: any) => {
        updatedInventory = data;
        return { id: "inv-1", availableQty: data.availableQty };
      },
    },
    auditLog: { create: async () => ({ id: "log-1" }) },
  };

  Object.assign(prisma, {
    $transaction: async (cb: any) => cb(fakeTx),
  });
  t.after(() => Object.assign(prisma, originalPrisma));

  // Test CATEGORY_CREATE
  const reqCat = new Request("http://localhost/api/mobile/admin/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "CATEGORY_CREATE",
      name: "Handcrafted Toys",
      description: "Organic wooden toys",
    }),
  });
  const resCat = await postAdminAction(reqCat);
  assert.equal(resCat.status, 200);
  assert.equal(createdCategory.name, "Handcrafted Toys");
  assert.equal(createdCategory.slug, "handcrafted-toys");

  // Test INVENTORY_UPDATE
  const reqInv = new Request("http://localhost/api/mobile/admin/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "INVENTORY_UPDATE",
      productId: "prod-1",
      availableQty: 85,
    }),
  });
  const resInv = await postAdminAction(reqInv);
  assert.equal(resInv.status, 200);
  assert.equal(updatedInventory.availableQty, 85);
});
