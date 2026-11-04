import { accountsReport, accountsCsv } from "@/lib/accounts-report";
import { portalUser, apiError } from "@/lib/portal-access";

export async function GET(request: Request) {
  try {
    await portalUser("ADMIN");
    const params = new URL(request.url).searchParams;
    const report = await accountsReport(Object.fromEntries(params));
    return new Response(accountsCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="zera-accounts-${report.from}-${report.to}.csv"`, "Cache-Control": "no-store, private", Vary: "Cookie" } });
  } catch (error) { return apiError(error); }
}
