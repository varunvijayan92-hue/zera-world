import { z } from "zod";

export const supplierSchema = z.object({
  sourceType: z.enum(["DIRECT", "EXTERNAL_SITE"]).default("DIRECT"),
  companyName: z.string().min(1),
  contactName: z.string().optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  provider: z.string().optional().or(z.literal("")),
  integrationType: z.enum(["API", "APP", "CSV", "MANUAL"]).optional(),
  country: z.string().optional().or(z.literal("")),
  shippingDestinations: z.string().optional().or(z.literal("")),
  currency: z.string().optional().default("INR"),
  status: z.enum(["ACTIVE", "INACTIVE", "PENDING"]).optional(),
  connectionStatus: z.enum(["CONNECTED", "PENDING", "DISCONNECTED", "REQUIRES_APPROVAL"]).optional(),
  autoOrderProcessing: z.coerce.boolean().optional(),
  minOrderQty: z.coerce.number().optional(),
  leadTimeDays: z.coerce.number().optional(),
  processingTimeDays: z.coerce.number().optional(),
  estimatedDeliveryDays: z.coerce.number().optional(),
  shippingCharges: z.coerce.number().optional(),
  gstNumber: z.string().optional().or(z.literal("")),
  gstRegistered: z.coerce.boolean().optional().default(false),
  gstRate: z.coerce.number().finite().min(0).max(100).optional(),
  returnPolicy: z.string().optional().or(z.literal("")),
  returnAddress: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const supplierProductMappingSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().optional().or(z.literal("")),
  supplierId: z.string().min(1),
  externalProductId: z.string().min(1),
  supplierSku: z.string().optional().or(z.literal("")),
  supplierVariantId: z.string().optional().or(z.literal("")),
  supplierProductUrl: z.string().url().optional().or(z.literal("")),
  purchaseCost: z.coerce.number().min(0).optional(),
  currency: z.string().optional().default("INR"),
  shippingCost: z.coerce.number().min(0).optional(),
  shippingDestination: z.string().optional().or(z.literal("")),
  lastStockCheckAt: z.string().datetime({ offset: true }).optional().or(z.literal("")),
  supplierAvailability: z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "UNKNOWN"]).optional().default("UNKNOWN"),
  estimatedDeliveryDays: z.coerce.number().int().min(0).optional(),
  mappingStatus: z.enum(["ACTIVE", "PENDING", "DISABLED", "REVIEW"]).optional().default("ACTIVE"),
  isPreferred: z.coerce.boolean().optional().default(false),
  isFallback: z.coerce.boolean().optional().default(false),
});

export const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  barcode: z.string().optional(),
  description: z.string().optional(),
  specifications: z.string().nullable().optional(),
  manufacturerInfo: z.string().nullable().optional(),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  availableQty: z.coerce.number().int().min(0).max(1000000).optional(),
  brand: z.string().optional(),
  size: z.preprocess(value => value === "" ? null : (typeof value === "string" ? value.trim() : value), z.string().trim().max(255).nullable().optional()),
  warranty: z.preprocess(value => value === "" ? null : (typeof value === "string" ? value.trim() : value), z.string().trim().max(255).nullable().optional()),
  trend: z.preprocess(value => value === "" ? null : (typeof value === "string" ? value.trim() : value), z.string().trim().max(255).nullable().optional()),
  inTheBox: z.preprocess(value => value === "" ? null : (typeof value === "string" ? value.trim() : value), z.string().trim().max(2000).nullable().optional()),
  supplierId: z.preprocess(value => value === "" ? null : value, z.string().nullable().optional()),
  gstRate: z.coerce.number().finite().min(0).max(100).optional(),
  deliveryCharge: z.coerce.number().finite().min(0).max(100000).optional(),
  handlingCharge: z.coerce.number().finite().min(0).max(100000).optional(),
  returnDays: z.coerce.number().int().min(0).max(365).optional(),
  isReturnable: z.boolean().optional(),
  codAvailable: z.boolean().optional(),
  costPrice: z.coerce.number().min(0).optional(),
  sellingPrice: z.coerce.number().min(0).optional(),
  mrp: z.preprocess(value => value === "" ? null : value, z.coerce.number().finite().positive().max(9999999999.99).multipleOf(0.01).nullable().optional()),
  hsnCode: z.string().trim().regex(/^\d{2,8}$/, "Enter an HSN code with 2 to 8 digits.").nullable().optional().or(z.literal("").transform(() => null)),
  imageUrls: z.array(z.string().url()).optional().default([]),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});

export const inventorySchema = z.object({
  productId: z.string().min(1),
  warehouseId: z.string().optional(),
  supplierId: z.string().optional(),
  availableQty: z.coerce.number().int().min(0),
  reservedQty: z.coerce.number().int().min(0).default(0),
  damagedQty: z.coerce.number().int().min(0).default(0),
  safetyStock: z.coerce.number().int().min(0).default(0),
});

export const marketplaceConfigSchema = z.object({
  type: z.enum(["AMAZON", "FLIPKART"]),
  merchantId: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  isSandbox: z.boolean().optional(),
});

export const checkoutItemSchema = z.object({
  productId: z.string().min(1),
  sku: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10),
});

export const checkoutAddressSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(6),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional().or(z.literal("")),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(3),
  country: z.string().min(1),
  landmark: z.string().optional().or(z.literal("")),
});

export const checkoutRequestSchema = z.object({
  cart: z.array(checkoutItemSchema).min(1).max(10).superRefine((items, context) => {
    if (items.reduce((sum, item) => sum + item.quantity, 0) > 10) context.addIssue({ code: z.ZodIssueCode.custom, message: "A cart can contain a maximum of 10 units." });
    if (new Set(items.map((item) => item.productId)).size !== items.length) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate cart products are not allowed." });
    }
  }),
  shippingAddress: checkoutAddressSchema,
  expectedTotalPaise: z.number().int().min(100).optional(),
  paymentMethod: z.enum(["razorpay", "manual", "cod"]).default("razorpay"),
  idempotencyKey: z.string().min(16).max(128).optional(),
});

export const paymentWebhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string().optional(),
        amount: z.number().optional(),
        currency: z.string().optional(),
        status: z.string().optional(),
      }),
    }),
  }),
  id: z.string().optional(),
});

export const refundRequestSchema = z.object({
  paymentId: z.string().min(1),
  amount: z.coerce.number().min(1),
  reason: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const orderSchema = z.object({
  marketplaceType: z.enum(["AMAZON", "FLIPKART"]),
  marketplaceOrderId: z.string().min(1),
  customerName: z.string().optional(),
  totalAmount: z.coerce.number().min(0),
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED", "REFUNDED"]).optional(),
  shippingAddress: z.object({
    fullName: z.string().optional(),
    phone: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pincode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  supplierAssignments: z.array(
    z.object({
      supplierId: z.string().min(1),
      supplierName: z.string().min(1),
    })
  ).optional(),
  items: z.array(
    z.object({
      productId: z.string().optional(),
      marketplaceSku: z.string().optional(),
      quantity: z.coerce.number().int().min(1),
      unitPrice: z.coerce.number().min(0),
    })
  ).min(1),
});

export const supplierApprovalDecisionSchema = z.object({
  marketplaceType: z.enum(["AMAZON", "FLIPKART"]),
  marketplaceOrderId: z.string().min(1),
  supplierId: z.string().optional().or(z.literal("")),
  supplierName: z.string().min(1),
  productId: z.string().optional().or(z.literal("")),
  customerName: z.string().optional().or(z.literal("")),
  orderId: z.string().optional().or(z.literal("")),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).default("PENDING"),
  action: z.enum(["MANUAL_APPROVAL", "AUTO_SUBMIT", "REJECTED"]).default("MANUAL_APPROVAL"),
  decisionReason: z.string().optional().or(z.literal("")),
  idempotencyKey: z.string().min(1),
  reviewerName: z.string().optional().or(z.literal("")),
});

export const mappingSchema = z.object({
  productId: z.string().min(1),
  supplierSku: z.string().optional(),
  amazonMarketplaceSku: z.string().optional(),
  flipkartMarketplaceSku: z.string().optional(),
  amazonListingId: z.string().optional(),
  flipkartListingId: z.string().optional(),
});
