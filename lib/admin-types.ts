export type AdminProduct = {
  id: string; name: string; sku: string; description: string; brand: string;
  categoryId: string | null; category: string | null;
  supplierId: string | null; supplierName: string | null;
  sellingPrice: number; costPrice: number; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  gstRate: number; handlingCharge: number; returnDays: number; isReturnable: boolean;
  imageUrls: string[]; availableQty: number;
};
