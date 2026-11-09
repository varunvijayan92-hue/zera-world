import { z } from "zod";

export const cjProductMappingSchema = z.object({
  productId: z.string().trim().min(1).max(100),
  supplierId: z.string().trim().min(1).max(100),
  externalProductId: z.string().trim().min(1).max(100),
  supplierVariantId: z.string().trim().min(1).max(100),
  supplierSku: z.string().trim().max(100).default(""),
});
