import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ReportsPage() {
  await requireAuth();

  const approvals = await prisma.supplierApprovalDecision.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const reportCards = [
    { label: "Sales", value: "₹18.4L" },
    { label: "Profit", value: "₹4.8L" },
    { label: "Returns", value: "3.2%" },
    { label: "Inventory", value: "2,140 units" },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Reports</p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">Performance overview</h1>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-black text-slate-900">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-black text-slate-900">Supplier approval audit</h2>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700">
            {approvals.length} records
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Supplier</th>
                <th className="px-4 py-3 font-semibold">Decision</th>
                <th className="px-4 py-3 font-semibold">Reason</th>
                <th className="px-4 py-3 font-semibold">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length ? approvals.map((approval) => (
                <tr key={approval.id} className="border-t border-slate-200">
                  <td className="px-4 py-3 font-semibold text-slate-900">{approval.marketplaceOrderId}</td>
                  <td className="px-4 py-3 text-slate-700">{approval.supplierName}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${approval.status === "APPROVED" ? "bg-emerald-100 text-emerald-700" : approval.status === "REJECTED" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}>
                      {approval.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{approval.decisionReason || approval.action}</td>
                  <td className="px-4 py-3 text-slate-700">{approval.reviewedAt ? new Date(approval.reviewedAt).toLocaleString() : new Date(approval.createdAt).toLocaleString()}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">No supplier approval decisions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
