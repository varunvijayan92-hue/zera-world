export { POST } from "@/app/api/admin/users/route";
import { GET as readSection } from "@/app/api/mobile/admin/[section]/route";
export async function GET(request: Request) { return readSection(request, { params: Promise.resolve({ section: "users" }) }); }
