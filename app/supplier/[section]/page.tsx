import { redirect } from "next/navigation";
export default async function LegacySupplierPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  redirect(`/suppliers/${encodeURIComponent(section)}`);
}
