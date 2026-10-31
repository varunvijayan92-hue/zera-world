import Link from "next/link";
import { Children, type ReactNode } from "react";

export function AdminHeading({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black tracking-tight">{title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#173B35]/65">{description}</p></div>{children}</div>;
}
export function AdminTable({ columns, children, empty = "No records yet." }: { columns: string[]; children: ReactNode; empty?: string }) {
  return <div className="overflow-x-auto rounded-2xl border border-[#173B35]/10 bg-white"><table className="w-full text-left text-sm"><thead className="border-b border-[#173B35]/10 bg-[#F0F2ED]"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[#173B35]/65">{column}</th>)}</tr></thead><tbody className="divide-y divide-[#173B35]/10 [&_td]:px-5 [&_td]:py-4 [&_td]:align-top">{Children.count(children) ? children : <tr><td colSpan={columns.length} className="py-12 text-center text-[#173B35]/55">{empty}</td></tr>}</tbody></table></div>;
}
export function AdminStat({ label, value, detail, href }: { label: string; value: ReactNode; detail?: string; href?: string }) {
  const content = <><p className="text-xs font-semibold uppercase tracking-wide text-[#173B35]/55">{label}</p><p className="mt-3 text-3xl font-black tracking-tight">{value}</p>{detail ? <p className="mt-2 text-xs text-[#173B35]/55">{detail}</p> : null}</>;
  return href ? <Link href={href} className="rounded-2xl border border-[#173B35]/10 bg-white p-5 transition hover:border-[#173B35]/35">{content}</Link> : <div className="rounded-2xl border border-[#173B35]/10 bg-white p-5">{content}</div>;
}
export function StateBadge({ value }: { value?: string | null }) {
  const text = value || "NOT_SET";
  const positive = ["PAID", "ACTIVE", "DELIVERED", "APPROVED", "SUCCESS", "AVAILABLE"].includes(text);
  const negative = ["FAILED", "CANCELLED", "REJECTED", "INACTIVE"].includes(text);
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${positive ? "bg-emerald-50 text-emerald-800" : negative ? "bg-red-50 text-red-800" : "bg-[#F0F2ED] text-[#173B35]/75"}`}>{text.replaceAll("_", " ")}</span>;
}
export function AdminNotice({ children }: { children: ReactNode }) {
  return <div className="mb-6 rounded-2xl border border-[#173B35]/15 bg-white px-5 py-4 text-sm leading-relaxed text-[#173B35]/70">{children}</div>;
}
