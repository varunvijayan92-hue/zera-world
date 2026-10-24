import assert from "node:assert/strict";
import test from "node:test";

import {
  createSupplierOrderWorkflow,
  routeMarketplaceOrderToSuppliers,
  syncProductToMarketplaces,
  validateSupplierProductMapping,
} from "../lib/marketplace";
import { supplierSchema } from "../lib/validators";

test("syncProductToMarketplaces publishes a product to Amazon and Flipkart", () => {
  const result = syncProductToMarketplaces({
    id: "prod_123",
    name: "ZeraBot Smart Fan",
    sku: "ZERABOT-001",
    status: "ACTIVE",
    supplierId: "sup_001",
    sellingPrice: 2499,
    category: "Home Essentials",
    brand: "ZeraWorld",
    description: "Smart energy-saving fan with silent airflow.",
    imageUrls: [
      "https://cdn.example.com/fan-1.jpg",
      "https://cdn.example.com/fan-2.jpg",
    ],
  });

  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((item) => item.marketplace),
    ["AMAZON", "FLIPKART"]
  );
  assert.ok(result.every((item) => item.status === "SYNCED"));
  assert.equal(result[0].imageUrls.length, 2);
  assert.match(result[0].message, /photos/i);
  assert.match(result[1].message, /Flipkart/i);
});

test("routeMarketplaceOrderToSuppliers includes customer shipping details", () => {
  const dispatches = routeMarketplaceOrderToSuppliers({
    id: "ord_123",
    marketplaceType: "AMAZON",
    marketplaceOrderId: "AZ-1001",
    customerName: "Rohit Sharma",
    totalAmount: 2499,
    status: "PENDING",
    shippingAddress: {
      fullName: "Rohit Sharma",
      phone: "9876543210",
      addressLine1: "12 Green Park",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
    },
    supplierAssignments: [
      { supplierId: "sup_001", supplierName: "Apex Supply Co." },
    ],
  });

  assert.equal(dispatches.length, 1);
  assert.match(dispatches[0].message, /customer/i);
  assert.match(dispatches[0].message, /Bengaluru/i);
  assert.equal(dispatches[0].supplierId, "sup_001");
});

test("supplierSchema accepts dropshipping supplier metadata and keeps required fields strict", () => {
  const result = supplierSchema.safeParse({
    companyName: "BluePeak Supply",
    contactName: "Ananya Rao",
    email: "hello@bluepeak.example",
    phone: "+91 98765 43210",
    website: "https://bluepeak.example",
    provider: "Apex Supplier Network",
    integrationType: "API",
    country: "India",
    shippingDestinations: "India, UAE",
    currency: "INR",
    minOrderQty: 50,
    processingTimeDays: 3,
    estimatedDeliveryDays: 7,
    returnPolicy: "7-day return window",
    returnAddress: "12 Market Road, Bengaluru",
    status: "ACTIVE",
    connectionStatus: "CONNECTED",
    autoOrderProcessing: true,
  });

  assert.equal(result.success, true);
  assert.equal(result.success ? result.data.provider : "", "Apex Supplier Network");
});

test("validateSupplierProductMapping rejects unavailable or mismatched supplier product mappings", () => {
  const invalid = validateSupplierProductMapping({
    productId: "prod_1",
    supplierId: "sup_1",
    externalProductId: "",
    supplierSku: "",
    supplierProductUrl: "https://example.com/product",
    purchaseCost: 200,
    currency: "INR",
    shippingCost: 40,
    shippingDestination: "India",
    estimatedDeliveryDays: 10,
    supplierAvailability: "OUT_OF_STOCK",
    mappingStatus: "ACTIVE",
  });

  assert.equal(invalid.isValid, false);
  assert.match(invalid.message, /supplier product|available/i);

  const valid = validateSupplierProductMapping({
    productId: "prod_2",
    supplierId: "sup_2",
    externalProductId: "SUP-1001",
    supplierSku: "SUP-1001",
    supplierProductUrl: "https://supplier.example/products/SUP-1001",
    purchaseCost: 280,
    currency: "INR",
    shippingCost: 35,
    shippingDestination: "India",
    estimatedDeliveryDays: 6,
    supplierAvailability: "IN_STOCK",
    mappingStatus: "ACTIVE",
  });

  assert.equal(valid.isValid, true);
  assert.equal(valid.status, "READY");
});

test("createSupplierOrderWorkflow routes unsupported or unapproved suppliers to manual review", () => {
  const outcome = createSupplierOrderWorkflow({
    orderId: "ord_1",
    marketplaceType: "AMAZON",
    supplierId: "sup_1",
    supplierName: "Northline Goods",
    productId: "prod_1",
    totalAmount: 2000,
    shippingDestination: "India",
    mapping: {
      mappingStatus: "PENDING",
      supplierAvailability: "OUT_OF_STOCK",
      estimatedDeliveryDays: 10,
      externalProductId: "",
      supplierSku: "",
    },
    supplier: {
      connectionStatus: "REQUIRES_APPROVAL",
      autoOrderProcessing: false,
      integrationType: "MANUAL",
    },
  });

  assert.equal(outcome.status, "PENDING");
  assert.equal(outcome.action, "MANUAL_APPROVAL");
  assert.equal(outcome.submittedToSupplier, false);
});

test("createSupplierOrderWorkflow prevents duplicate supplier jobs for the same order idempotency key", () => {
  const first = createSupplierOrderWorkflow({
    orderId: "ord_dup",
    marketplaceType: "FLIPKART",
    supplierId: "sup_2",
    supplierName: "BluePeak Supply",
    productId: "prod_2",
    totalAmount: 1600,
    shippingDestination: "India",
    mapping: {
      mappingStatus: "ACTIVE",
      supplierAvailability: "IN_STOCK",
      estimatedDeliveryDays: 5,
      externalProductId: "SUP-999",
      supplierSku: "SUP-999",
    },
    supplier: {
      connectionStatus: "CONNECTED",
      autoOrderProcessing: true,
      integrationType: "API",
    },
  });

  const second = createSupplierOrderWorkflow({
    orderId: "ord_dup",
    marketplaceType: "FLIPKART",
    supplierId: "sup_2",
    supplierName: "BluePeak Supply",
    productId: "prod_2",
    totalAmount: 1600,
    shippingDestination: "India",
    mapping: {
      mappingStatus: "ACTIVE",
      supplierAvailability: "IN_STOCK",
      estimatedDeliveryDays: 5,
      externalProductId: "SUP-999",
      supplierSku: "SUP-999",
    },
    supplier: {
      connectionStatus: "CONNECTED",
      autoOrderProcessing: true,
      integrationType: "API",
    },
  });

  assert.equal(first.idempotencyKey, second.idempotencyKey);
  assert.equal(second.duplicate, true);
  assert.equal(second.status, "DUPLICATE");
});
