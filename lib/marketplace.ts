
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
  return {
    type,
    name: type === "AMAZON" ? "Amazon SP-API" : "Flipkart Seller APIs",
    status: "Not Connected",
    isConnected: false,
    message: "No live marketplace connector is enabled. Saved credentials alone do not enable listing, order or return synchronization.",
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
    : [];
  const productSummary = [
    product.brand ? `Brand: ${product.brand}` : null,
    product.category ? `Category: ${product.category}` : null,
    product.description ? `Description: ${product.description}` : null,
  ].filter(Boolean).join(" | ");

  const baseMessage = productSummary
    ? `Product ${product.name} prepared with photos and details (${productSummary}).`
    : `Product ${product.name} prepared with photos and product details.`;

  return [
    {
      marketplace: "AMAZON",
      status: "PENDING",
      listingId: "",
      sku: product.sku,
      price,
      imageUrls,
      message: `${baseMessage} Not published to Amazon: the live connector is not enabled.`,
    },
    {
      marketplace: "FLIPKART",
      status: "PENDING",
      listingId: "",
      sku: product.sku,
      price,
      imageUrls,
      message: `${baseMessage} Not published to Flipkart: the live connector is not enabled.`,
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
    message: `Marketplace order ${order.marketplaceOrderId} (${order.marketplaceType}) is prepared for ${supplier.supplierName}; it has not been submitted to the supplier. Customer ${order.customerName || "Guest"} address: ${addressSummary}. Total amount: ₹${Number(order.totalAmount ?? 0).toLocaleString("en-IN")}.`,
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
  // This legacy function prepares a review only. Durable jobs and supplier API
  // submission require an implemented connector; never invent successful jobs.
  return {
    idempotencyKey: `${input.marketplaceType}:${input.orderId}:${input.supplierId}:${input.productId}`,
    duplicate: false,
    status: "PENDING",
    action: "MANUAL_APPROVAL",
    submittedToSupplier: false,
    supplierName: input.supplierName,
    message: "Prepared for manual review only. No supplier job or shipment has been created.",
    durableJob: null,
  };
}
