import { SupplierPortalForm } from "./supplier-forms";
import { supplierPickupFields } from "@/lib/supplier-address";

export function SupplierAddressEditor({ supplierId, address, values }: { supplierId: string; address: string | null; values: Record<string, string> }) {
  return <div className="mt-3 min-w-56 max-w-sm"><p className="break-words text-xs text-[#173B35]/70">{address || "Pickup/local address not added"}</p><details className="mt-2"><summary className="cursor-pointer text-xs font-semibold underline">Edit pickup/local address</summary><SupplierPortalForm method="PATCH" url={`/api/admin/suppliers/${supplierId}/address`} action="PICKUP_ADDRESS" optionalFields={["contactName", "phone", "pickupAddressLine2", "pickupDistrict", "pickupLandmark"]} fields={[["contactName", "Pickup contact name", "text"], ["phone", "Pickup contact phone", "tel"], ...supplierPickupFields]} defaults={values} /><p className="text-xs">Link the registered Shiprocket pickup location separately. Changing this address clears its old mapping for review.</p></details></div>;
}
