export { POST, PATCH } from "@/app/api/supplier/local-customers/route";
import { GET as readSection } from "@/app/api/mobile/supplier/[section]/route";
export async function GET(request: Request) { return readSection(request, { params: Promise.resolve({ section: "local-customers" }) }); }
