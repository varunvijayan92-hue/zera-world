export { PATCH, DELETE } from "@/app/api/categories/[id]/route";
import { GET as readDetail } from "@/app/api/mobile/admin/[section]/[id]/route";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; return readDetail(request, { params: Promise.resolve({ section: "categories", id }) }); }
