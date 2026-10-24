"use client";

import { useMemo, useState } from "react";

import { createSupplierOrderWorkflow } from "@/lib/marketplace";

type ReviewItem = {
  id: string;
  marketplaceOrderId: string;
  marketplaceType: string;
  supplierName?: string;
  totalAmount?: number;
  status?: string;
  itemCount?: number;
  customerName?: string;
};

export function SupplierApprovalReview({ items }: { items: ReviewItem[] }) {
  const [decisionMap, setDecisionMap] = useState<Record<string, "APPROVED" | "REJECTED" | "PENDING">>({});

  const reviewItems = useMemo(
    () =>
      items.map((item) => {
        const workflow = createSupplierOrderWorkflow({
          orderId: item.id,
          marketplaceType: (item.marketplaceType || "AMAZON") as "AMAZON" | "FLIPKART",
          supplierId: item.supplierName ? `supplier-${item.id}` : "supplier-pending",
          supplierName: item.supplierName || "Unassigned Supplier",
          productId: item.id,
          totalAmount: item.totalAmount ?? 0,
          shippingDestination: "India",
          mapping: {
            mappingStatus: "ACTIVE",
            supplierAvailability: "IN_STOCK",
            estimatedDeliveryDays: 7,
            externalProductId: "SUP-READY",
            supplierSku: `SKU-${item.id}`,
            purchaseCost: Number(item.totalAmount ?? 0) * 0.58,
            shippingCost: 60,
          },
          supplier: {
            connectionStatus: "PENDING",
            autoOrderProcessing: false,
            integrationType: "MANUAL",
          },
        });

        const action = decisionMap[item.id] || (workflow.status === "PENDING" ? "PENDING" : "APPROVED");

        return {
          ...item,
          workflow,
          action,
        };
      }),
    [items, decisionMap]
  );

  const pendingCount = reviewItems.filter((item) => item.action === "PENDING").length;
  const approvedCount = reviewItems.filter((item) => item.action === "APPROVED").length;
  const rejectedCount = reviewItems.filter((item) => item.action === "REJECTED").length;

  const handleDecision = async (id: string, action: "APPROVED" | "REJECTED") => {
    const item = reviewItems.find((entry) => entry.id === id);
    if (!item) {
      return;
    }

    const payload = {
      marketplaceType: item.marketplaceType,
      marketplaceOrderId: item.marketplaceOrderId,
      supplierId: item.supplierName ? `supplier-${item.id}` : "supplier-pending",
      supplierName: item.supplierName || "Unassigned Supplier",
      productId: item.id,
      customerName: item.customerName || "Marketplace buyer",
      orderId: item.id,
      status: action,
      action: action === "APPROVED" ? "AUTO_SUBMIT" : "REJECTED",
      decisionReason: action === "APPROVED"
        ? "Approved by admin review and safe for fulfilment queue."
        : "Rejected by admin review because the supplier or mapping was not approved for dispatch.",
      idempotencyKey: `${item.marketplaceType}:${item.id}:supplier-review`,
      reviewerName: "Admin",
    };

    try {
      await fetch("/api/supplier-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Store the local UI state even if persistence is temporarily unavailable.
    }

    setDecisionMap((current) => ({ ...current, [id]: action }));
  };

  if (!reviewItems.length) {
    return null;
  }

  return (
    <section className="mt-8 rounded-[30px] border border-[#173B35]/10 bg-white p-6 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#173B35]/60">Supplier approval</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.06em] text-[#173B35]">Manual review queue</h2>
        </div>
        <div className="rounded-full border border-[#173B35]/10 bg-[#F7F4ED] px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#173B35]/70">
          Manual approval only • no live supplier purchase
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#173B35]/60">Queued</p>
          <p className="mt-2 text-3xl font-black text-[#173B35]">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#173B35]/60">Approved</p>
          <p className="mt-2 text-3xl font-black text-[#173B35]">{approvedCount}</p>
        </div>
        <div className="rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-[#173B35]/60">Rejected</p>
          <p className="mt-2 text-3xl font-black text-[#173B35]">{rejectedCount}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {reviewItems.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-[#173B35]/10 bg-[#F7F4ED] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#173B35]/60">{item.marketplaceType}</p>
                <h3 className="mt-1 text-xl font-black tracking-[-0.05em] text-[#173B35]">{item.marketplaceOrderId}</h3>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#173B35]">
                {item.action}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#173B35]/60">Supplier</p>
                <p className="mt-2 text-sm font-semibold text-[#173B35]">{item.supplierName || "Awaiting assignment"}</p>
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#173B35]/60">Customer</p>
                <p className="mt-2 text-sm font-semibold text-[#173B35]">{item.customerName || "Marketplace buyer"}</p>
              </div>
              <div>
                <p className="text-[0.7rem] uppercase tracking-[0.18em] text-[#173B35]/60">Order value</p>
                <p className="mt-2 text-sm font-semibold text-[#173B35]">₹{Number(item.totalAmount ?? 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#173B35]/10 bg-white p-3 text-sm text-[#173B35]/70">
              {item.workflow.message}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDecision(item.id, "APPROVED")}
                className="rounded-xl bg-[#173B35] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f2a26]"
              >
                Approve for dispatch
              </button>
              <button
                type="button"
                onClick={() => handleDecision(item.id, "REJECTED")}
                className="rounded-xl border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35] transition hover:bg-[#F7F4ED]"
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
