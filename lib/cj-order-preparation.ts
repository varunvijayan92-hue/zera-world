import { matchCjVariant } from "./cj-variant-match";
import { checkoutAddressSchema } from "./validators";

type Mapping = {
  supplierVariantKey: string | null;
  supplierVariantId: string | null;
  supplierSku: string | null;
  mappingStatus: string | null;
};

type Line = {
  id: string;
  quantity: number;
  color: string | null;
  size: string | null;
  mappings: Mapping[];
};

/** Build CJ product lines only when every customer's selection maps uniquely. */
export function prepareCjOrderLines(lines: Line[]) {
  if (!lines.length) throw new Error("No CJ products to submit.");
  return lines.map((line) => {
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new Error("Invalid order quantity.");
    const mapping = matchCjVariant(line.mappings, line.color, line.size);
    if (!mapping?.supplierVariantId || !mapping.supplierSku) throw new Error("A CJ variant needs review.");
    return { vid: mapping.supplierVariantId, sku: mapping.supplierSku, quantity: line.quantity, storeLineItemId: line.id };
  });
}

/** Unknown costs, rates, or an unapproved carrier always require review. */
export function cjCostReview(input: { saleInr: number; costUsd: number; usdToInr: number; shippingMethod: string; approvedMethods: string[] }) {
  const { saleInr, costUsd, usdToInr, shippingMethod, approvedMethods } = input;
  if (![saleInr, costUsd, usdToInr].every(Number.isFinite) || saleInr <= 0 || costUsd < 0 || usdToInr <= 0) return "Cost or exchange rate unavailable";
  if (!approvedMethods.includes(shippingMethod)) return "Shipping method is not approved";
  if (costUsd * usdToInr > saleInr) return "CJ cost exceeds the sale";
  return null;
}

/** Check the authoritative CJ order total and wallet balance before attempting payment. */
export function cjWalletReview(input: { totalUsd: number; balanceUsd: number }) {
  if (!Number.isFinite(input.totalUsd) || input.totalUsd <= 0 || !Number.isFinite(input.balanceUsd) || input.balanceUsd < 0) return "CJ total or wallet balance unavailable";
  if (Math.round(input.balanceUsd * 100) < Math.ceil(input.totalUsd * 100)) return "Insufficient CJ Wallet balance";
  return null;
}

/** Create an unpaid CJ API payload. Calling CJ and payment require a separate worker. */
export function prepareCjCreateOrder(input: { orderNumber: string; address: unknown; origin: string; logisticName: string; lines: Line[] }) {
  const address = checkoutAddressSchema.parse(input.address);
  if (!/^[A-Z]{2}$/.test(input.origin) || !input.logisticName.trim() || input.logisticName.length > 50) throw new Error("CJ shipping method or origin needs review.");
  if (!input.orderNumber || input.orderNumber.length > 50 || !/^\d{6}$/.test(address.pincode)) throw new Error("Order reference or delivery PIN needs review.");
  if (!/^(india|in)$/i.test(address.country.trim())) throw new Error("CJ destination needs review.");
  if (address.fullName.length > 50 || address.state.length > 50 || address.city.length > 50 || address.addressLine1.length > 500 || (address.addressLine2?.length || 0) > 500 || address.phone.length > 20 || address.email.length > 50) throw new Error("Delivery details exceed CJ limits.");
  return {
    orderNumber: input.orderNumber, shippingZip: address.pincode, shippingCountryCode: "IN", shippingCountry: "India",
    shippingProvince: address.state, shippingCity: address.city, shippingPhone: address.phone,
    shippingCustomerName: address.fullName, shippingAddress: address.addressLine1, shippingAddress2: address.addressLine2 || "",
    email: address.email, logisticName: input.logisticName, fromCountryCode: input.origin,
    orderFlow: 1, payType: 3, products: prepareCjOrderLines(input.lines),
  };
}
