export type AdminProduct = {
  id: string; name: string; sku: string; description: string; specifications?: string | null; manufacturerInfo?: string | null; brand: string; size?: string | null;
  warranty?: string | null; trend?: string | null; inTheBox?: string | null;
  categoryId: string | null; category: string | null;
  supplierId: string | null; supplierName: string | null;
  sellingPrice: number; costPrice: number; status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  mrp?: number | null; hsnCode?: string | null; deliveryCharge?: number | null;
  gstRate: number; handlingCharge: number; returnDays: number; isReturnable: boolean;
  imageUrls: string[]; availableQty: number;
};
