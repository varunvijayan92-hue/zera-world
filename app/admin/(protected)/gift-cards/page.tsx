import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminHeading, AdminNotice, AdminTable } from "@/components/admin-ui";
import { GiftCardForm } from "@/components/gift-card-form";
import { adminDate, inr } from "@/lib/admin-format";
import { giftCardStatus } from "@/lib/gift-cards";

export default async function GiftCardsPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const actor = await requireStoreAdmin(); const { q = "" } = searchParams ? await searchParams : {};
  const query = q.trim().slice(0, 100);
  const cards = await prisma.customerVoucher.findMany({ where: query ? { OR: [{ code: { contains: query, mode: "insensitive" } }, { customer: { email: { contains: query, mode: "insensitive" } } }] } : {}, include: { customer: { select: { fullName: true, email: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-6xl p-5 md:p-8"><AdminHeading title="Gift cards" description="Create and assign gift cards to registered customers; review the latest 100 matching cards." /><AdminNotice>Cards appear in the customer&apos;s Gift cards &amp; vouchers section. Customers can use a valid card covering their full checkout total. Creating a card does not collect a payment or send an email.</AdminNotice>{actor.role === "ADMIN" ? <GiftCardForm /> : <AdminNotice>Only administrators can issue gift cards. Managers can review existing records.</AdminNotice>}<form className="mb-5 flex gap-3"><input aria-label="Search gift cards" name="q" defaultValue={query} placeholder="Search code or customer email" maxLength={100} className="min-w-0 flex-1 rounded-xl border bg-white p-3" /><button className="rounded-xl border bg-white px-5 py-3">Search</button></form><AdminTable columns={["Code", "Customer", "Balance", "Status", "Expiry", "Created"]} empty="No gift cards found.">{cards.map(card => <tr key={card.id}><td className="break-all font-mono text-xs">{card.code}</td><td>{card.customer.fullName}<p className="break-all text-xs">{card.customer.email}</p></td><td>{inr(card.balance)}</td><td>{giftCardStatus(card)}</td><td>{card.expiresAt ? adminDate(card.expiresAt) : "No expiry"}</td><td>{adminDate(card.createdAt)}</td></tr>)}</AdminTable></main>;
}
