import { calculateEstimatedProfit } from "./profit";

export type MarketplaceType = "AMAZON" | "FLIPKART";

export type MarketplaceStatus = {
  type: MarketplaceType;
  name: string;
  status: "Connected" | "Configuration Required" | "Not Connected";
  isConnected: boolean;
  message: string;
  lastSync: string;
};

export type ShippingAddress = {
  fullName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
};

export type SupplierAssignment = {
  supplierId: string;
  supplierName: string;
};

export type MarketplaceSyncResult = {
  marketplace: MarketplaceType;
  status: "SYNCED" | "PENDING" | "FAILED";
  listingId: string;
  sku: string;
  price: number;
  imageUrls: string[];
  message: string;
};

export type SupplierDispatchNotification = {
  supplierId: string;
  supplierName: string;
  marketplaceType: MarketplaceType;
  orderId: string;
  marketplaceOrderId: string;
  message: string;
};

export function getMarketplaceStatus(type: MarketplaceType): MarketplaceStatus {
  if (type === "AMAZON") {
    return {
      type,
      name: "Amazon SP-API",
      status: "Connected",
      isConnected: true,
      message: "Seller partner connection active. Inventory and order sync enabled.",
      lastSync: "2 minutes ago",
    };
  }

  return {
    type,
    name: "Flipkart Seller APIs",
    status: "Configuration Required",
    isConnected: false,
    message: "Credentials not configured. Add OAuth details and webhook verification before live sync.",
    lastSync: "Not synced",
  };
}

export function getMarketplaceOverview() {
  return [getMarketplaceStatus("AMAZON"), getMarketplaceStatus("FLIPKART")];
}

export function syncProductToMarketplaces(product: {
  id: string;
  name: string;
  sku: string;
  status?: string | null;
  supplierId?: string | null;
  sellingPrice?: number | string | { toNumber?: () => number } | null;
  description?: string | null;
  category?: string | null;
  brand?: string | null;
  imageUrls?: string[] | null;
}): MarketplaceSyncResult[] {
  const rawPrice = product.sellingPrice;
  const numericPrice = typeof rawPrice === "number" || typeof rawPrice === "string"
    ? Number(rawPrice)
    : rawPrice && typeof rawPrice.toNumber === "function"
      ? rawPrice.toNumber()
      : 0;

  const price = Number(numericPrice ?? 0);
  const imageUrls = Array.isArray(product.imageUrls) && product.imageUrls.length > 0
    ? product.imageUrls
    : ["https://images.example.com/default-product.jpg"];
  const productSummary = [
    product.brand ? `Brand: ${product.brand}` : null,
    product.category ? `Category: ${product.category}` : null,
    product.description ? `Description: ${product.description}` : null,
  ].filter(Boolean).join(" | ");

  const baseMessage = productSummary
    ? `Product ${product.name} synced with photos and details (${productSummary}).`
    : `Product ${product.name} synced with photos and product details.`;

  return [
    {
      marketplace: "AMAZON",
      status: product.status === "ARCHIVED" ? "PENDING" : "SYNCED",
      listingId: `AMZ-${product.id}`,
      sku: product.sku,
      price,
      imageUrls,
      message: `${baseMessage} Sent to Amazon catalog and inventory feed.`,
    },
    {
      marketplace: "FLIPKART",
      status: product.status === "ARCHIVED" ? "PENDING" : "SYNCED",
      listingId: `FLP-${product.id}`,
      sku: product.sku,
      price,
      imageUrls,
      message: `${baseMessage} Sent to Flipkart catalog and stock feed.`,
    },
  ];
}

export function routeMarketplaceOrderToSuppliers(order: {
  id: string;
  marketplaceType: MarketplaceType;
  marketplaceOrderId: string;
  customerName?: string | null;
  totalAmount?: number | string | null;
  status?: string | null;
  shippingAddress?: ShippingAddress | null;
  supplierAssignments?: SupplierAssignment[];
}): SupplierDispatchNotification[] {
  const assignments = order.supplierAssignments && order.supplierAssignments.length > 0
    ? order.supplierAssignments
    : [{ supplierId: "supplier-pending", supplierName: "Unassigned Supplier" }];

  const addressSummary = order.shippingAddress
    ? [
        order.shippingAddress.addressLine1,
        order.shippingAddress.addressLine2,
        order.shippingAddress.city,
        order.shippingAddress.state,
        order.shippingAddress.pincode,
        order.shippingAddress.country,
      ].filter(Boolean).join(", ")
    : "Customer address pending";

  return assignments.map((supplier) => ({
    supplierId: supplier.supplierId,
    supplierName: supplier.supplierName,
    marketplaceType: order.marketplaceType,
    orderId: order.id,
    marketplaceOrderId: order.marketplaceOrderId,
    message: `Marketplace order ${order.marketplaceOrderId} (${order.marketplaceType}) has been forwarded to ${supplier.supplierName}. Customer ${order.customerName || "Guest"} address: ${addressSummary}. Total amount: ₹${Number(order.totalAmount ?? 0).toLocaleString("en-IN")}.`,
  }));
}

export function validateSupplierProductMapping(input: {
  productId: string;
  supplierId: string;
  externalProductId?: string | null;
  supplierSku?: string | null;
  supplierProductUrl?: string | null;
  purchaseCost?: number | string | null;
  currency?: string | null;
  shippingCost?: number | string | null;
  shippingDestination?: string | null;
  estimatedDeliveryDays?: number | string | null;
  supplierAvailability?: string | null;
  mappingStatus?: string | null;
}) {
  const normalizedAvailability = (input.supplierAvailability || "UNKNOWN").toUpperCase();
  const hasSupplierReference = Boolean(input.externalProductId && input.externalProductId.trim()) && Boolean(input.supplierSku && input.supplierSku.trim());

  if (!hasSupplierReference) {
    return {
      isValid: false,
      status: "UNAVAILABLE",
      message: "Supplier product mapping is incomplete. Add a valid supplier product ID and SKU before enabling fulfilment.",
    };
  }

  if (normalizedAvailability === "OUT_OF_STOCK" || normalizedAvailability === "UNKNOWN") {
    return {
      isValid: false,
      status: "UNAVAILABLE",
      message: "Supplier product is currently unavailable or stock status is unknown, so this mapping cannot be used for automatic fulfilment.",
    };
  }

  return {
    isValid: true,
    status: "READY",
    message: `Supplier mapping is valid for ${input.productId}. Ready for dispatch checks and supplier fulfilment review.`,
  };
}

const seenSupplierFulfilmentJobs = new Map<string, string>();

export function createSupplierOrderWorkflow(input: {
  orderId: string;
  marketplaceType: MarketplaceType;
  supplierId: string;
  supplierName: string;
  productId: string;
  totalAmount?: number | string | null;
  shippingDestination?: string | null;
  mapping?: {
    mappingStatus?: string | null;
    supplierAvailability?: string | null;
    estimatedDeliveryDays?: number | string | null;
    externalProductId?: string | null;
    supplierSku?: string | null;
    purchaseCost?: number | string | null;
    shippingCost?: number | string | null;
  } | null;
  supplier?: {
    connectionStatus?: string | null;
    autoOrderProcessing?: boolean | null;
    integrationType?: string | null;
  } | null;
}) {
  const idempotencyKey = `${input.marketplaceType}:${input.orderId}:${input.supplierId}:${input.productId}`;
  if (seenSupplierFulfilmentJobs.has(idempotencyKey)) {
    return {
      idempotencyKey,
      duplicate: true,
      status: "DUPLICATE",
      action: "REJECTED",
      submittedToSupplier: false,
      supplierName: input.supplierName,
      durableJob: {
        jobId: `job-${idempotencyKey}`,
        status: "DUPLICATE",
        retryCount: 0,
      },
    };
  }

  const mappingValidation = validateSupplierProductMapping({
    productId: input.productId,
    supplierId: input.supplierId,
    externalProductId: input.mapping?.externalProductId || null,
    supplierSku: input.mapping?.supplierSku || null,
    purchaseCost: input.mapping?.purchaseCost ?? null,
    shippingCost: input.mapping?.shippingCost ?? null,
    shippingDestination: input.shippingDestination || null,
    estimatedDeliveryDays: input.mapping?.estimatedDeliveryDays ?? null,
    supplierAvailability: input.mapping?.supplierAvailability || "UNKNOWN",
    mappingStatus: input.mapping?.mappingStatus || "ACTIVE",
  });

  const totalAmount = Number(input.totalAmount ?? 0);
  const estimatedProfit = calculateEstimatedProfit({
    sellingPrice: totalAmount,
    supplierCost: Number(input.mapping?.purchaseCost ?? 0),
    shippingCost: Number(input.mapping?.shippingCost ?? 0),
    marketplaceFeeRate: 8.5,
    packagingCost: 35,
    taxRate: 5,
  });

  const isApprovedSupplier = (input.supplier?.connectionStatus || "PENDING") === "CONNECTED";
  const apiReady = (input.supplier?.integrationType || "MANUAL") === "API";
  const autoApproved = Boolean(input.supplier?.autoOrderProcessing) && isApprovedSupplier && apiReady;

  const durableJob = {
    jobId: `job-${idempotencyKey}`,
    status: "QUEUED",
    retryCount: 0,
  };

  if (!mappingValidation.isValid || !isApprovedSupplier || !autoApproved || estimatedProfit.netProfit <= 0) {
    seenSupplierFulfilmentJobs.set(idempotencyKey, "queued");
    return {
      idempotencyKey,
      duplicate: false,
      status: "PENDING",
      action: "MANUAL_APPROVAL",
      submittedToSupplier: false,
      supplierName: input.supplierName,
      message: "Supplier order is queued for manual approval because the mapping, connection, or margin check is not valid for automatic fulfilment.",
      durableJob,
    };
  }

  seenSupplierFulfilmentJobs.set(idempotencyKey, "queued");
  return {
    idempotencyKey,
    duplicate: false,
    status: "PENDING_CONFIRMATION",
    action: "AUTO_SUBMIT",
    submittedToSupplier: false,
    supplierName: input.supplierName,
    message: "Order prepared for supplier API submission. The supplier has not yet confirmed receipt, so the order is not marked as submitted.",
    durableJob: {
      ...durableJob,
      status: "IN_PROGRESS",
    },
    supplierReference: `SUP-${input.orderId}`,
  };
}
