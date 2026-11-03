import { SupplierPortalForm } from "@/components/supplier-forms";
import { AdminAction } from "@/components/admin-action";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminHeading, AdminTable, AdminNotice, StateBadge } from "@/components/admin-ui";
import { adminDate, inr } from "@/lib/admin-format";
import { ReturnReview } from "@/components/return-review";
import { returnRefundControls } from "@/lib/return-refund";

export default async function ReturnsPage() {
  await requireStoreAdmin();
  const returns = await prisma.returnRequest.findMany({ include: { customerOrder: { select: { marketplaceOrderId: true, customerName: true } }, supplier: { select: { companyName: true } }, refunds: true }, orderBy: { createdAt: "desc" }, take: 100 });
  const payments = await prisma.paymentTransaction.findMany({ where: { orderId: { in: returns.map(entry => entry.customerOrderId) } }, select: { orderId: true, provider: true, paymentStatus: true, gatewayPaymentId: true } });
  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <AdminHeading title="Returns & RTO" description="Customer return reasons, supplier returns, receipt confirmation and refund records." />
    <AdminNotice>Approving or receiving a return does not automatically refund a payment or put stock back on sale. Review the item and payment method separately. COD repayment requires manual reconciliation.</AdminNotice>
    <h2 className="mb-3 font-bold">Record return to origin</h2>
    <SupplierPortalForm url="/api/admin/returns" action="RTO" fields={[["orderItemId", "Order item ID (from Orders)", "text"], ["quantity", "RTO quantity", "number"], ["reason", "Return-to-origin reason (at least 10 characters)", "text"]]} />
    <AdminTable columns={["Order / customer", "Item / quantity", "Reason / type", "Status", "Refund records", "Review"]} empty="No return requests.">
      {returns.map(entry => {
        const { isCod, canGatewayRefund } = returnRefundControls(payments.filter(payment => payment.orderId === entry.customerOrderId));
        return <tr key={entry.id}>
          <td>{entry.customerOrder.marketplaceOrderId}<p className="text-xs">{entry.customerOrder.customerName}</p><p className="text-xs">{adminDate(entry.createdAt)}</p></td>
          <td>{entry.orderItemId || "Legacy return"}<p>{entry.quantity} units</p><p>{entry.supplier?.companyName}</p></td>
          <td>{entry.reason}<p className="text-xs">{entry.returnType}</p></td>
          <td><StateBadge value={entry.status} />{entry.supplierReceivedAt ? <p className="mt-2 text-xs">Supplier receipt: {adminDate(entry.supplierReceivedAt)}</p> : null}{entry.receivedAt ? <p className="mt-2 text-xs">Received {adminDate(entry.receivedAt)}</p> : null}</td>
          <td>{entry.refunds.length ? entry.refunds.map(refund => <div key={refund.id} className="mb-2"><p>{inr(refund.amount)} · {refund.status}</p>{!isCod && refund.gatewayRefundId && refund.status !== "SUCCESS" ? <AdminAction url={`/api/admin/refunds/${refund.id}/reconcile`} label="Check refund status" /> : null}</div>) : "No refund recorded"}</td>
          <td><ReturnReview id={entry.id} status={entry.status} />{entry.status === "COMPLETED" && entry.receivedAt && !entry.refunds.length ? canGatewayRefund ? <AdminAction url={`/api/admin/returns/${entry.id}/refund`} label="Refund item + GST" confirm="Submit a real Razorpay refund for the returned item price plus GST? Shipping and handling are excluded. This action transfers money." /> : <p className="mt-3 max-w-xs text-xs">{isCod ? "COD refund: manual repayment and reconciliation are required. No online refund has been sent." : "A verified Razorpay payment is required before a gateway refund can be submitted."}</p> : null}</td>
        </tr>;
      })}
    </AdminTable>
  </main>;
}
