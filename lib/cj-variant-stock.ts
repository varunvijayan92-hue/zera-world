import { integrationCredentials } from "./integration-settings";
import { prisma } from "./prisma";

/** Refresh CJ's reported stock in the configured origin, without changing sellable store inventory. */
export async function refreshCjVariantStock(productId: string, cjProductId: string) {
  const [setting, product, credentials] = await Promise.all([
    prisma.integrationSetting.findUnique({ where: { provider: "CJ_DROPSHIPPING" }, select: { options: true } }),
    prisma.product.findUnique({ where: { id: productId }, select: { supplierId: true, supplier: { select: { provider: true, status: true } } } }),
    integrationCredentials("CJ_DROPSHIPPING"),
  ]);
  if (!product?.supplierId || product.supplier?.provider !== "CJ_DROPSHIPPING" || product.supplier.status !== "ACTIVE") throw new Error("Assign an active CJ supplier first.");
  const options = setting?.options && typeof setting.options === "object" && !Array.isArray(setting.options) ? setting.options as Record<string, unknown> : {};
  const policy = options.orderPolicy && typeof options.orderPolicy === "object" && !Array.isArray(options.orderPolicy) ? options.orderPolicy as Record<string, unknown> : {};
  const origin = typeof policy.origin === "string" && /^[A-Z]{2}$/.test(policy.origin) ? policy.origin : null;
  if (!origin || !credentials.apiKey) throw new Error("Configure the CJ API key and warehouse origin first.");
  const base = "https://developers.cjdropshipping.com/api2.0/v1";
  const auth = await fetch(`${base}/authentication/getAccessToken`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: credentials.apiKey }), signal: AbortSignal.timeout(20000), cache: "no-store" });
  const authData = await auth.json();
  if (!auth.ok || authData.code !== 200 || typeof authData.data?.accessToken !== "string") throw new Error("CJ authentication failed.");
  const response = await fetch(`${base}/product/stock/getInventoryByPid?${new URLSearchParams({ pid: cjProductId })}`, { headers: { "CJ-Access-Token": authData.data.accessToken }, signal: AbortSignal.timeout(20000), cache: "no-store" });
  const body = await response.json();
  if (!response.ok || body.code !== 200 || !Array.isArray(body.data?.variantInventories)) throw new Error("CJ did not return variant inventory.");
  const mappings = await prisma.supplierProductMapping.findMany({ where: { productId, supplierId: product.supplierId, externalProductId: cjProductId, mappingStatus: "ACTIVE" }, select: { id: true, supplierVariantId: true } });
  const rows: { id: string; qty: number }[] = [];
  for (const mapping of mappings) {
    const matches = body.data.variantInventories.filter((v: { vid?: unknown }) => v.vid === mapping.supplierVariantId);
    if (matches.length !== 1 || !Array.isArray(matches[0].inventory)) continue;
    const stock = matches[0].inventory.filter((row: { countryCode?: unknown }) => row.countryCode === origin);
    if (stock.length !== 1 || !Number.isSafeInteger(stock[0].totalInventory) || stock[0].totalInventory < 0 || stock[0].totalInventory > 2147483647) continue;
    rows.push({ id: mapping.id, qty: stock[0].totalInventory });
  }
  await prisma.$transaction(async tx => {
    // Missing or ambiguous CJ responses must never leave old quantities looking fresh.
    await tx.supplierProductMapping.updateMany({ where: { id: { in: mappings.map(m => m.id) } }, data: { supplierStockQty: null, supplierAvailability: "UNKNOWN", lastStockCheckAt: null } });
    for (const row of rows) await tx.supplierProductMapping.update({ where: { id: row.id }, data: { supplierStockQty: row.qty, supplierAvailability: row.qty > 0 ? "IN_STOCK" : "OUT_OF_STOCK", lastStockCheckAt: new Date() } });
  });
  return { updated: rows.length, unavailable: mappings.length - rows.length, origin };
}
