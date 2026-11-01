import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceCheckout } from "@/lib/checkout";
import { checkoutRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = checkoutRequestSchema.pick({ cart: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Please check the items and quantities in your order." }, { status: 400 });
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.cart.map((item) => item.productId) } }, include: { inventory: { where: { status: "AVAILABLE" } } },
    });
    const amount = priceCheckout(parsed.data.cart, products);
    const items = parsed.data.cart.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)!;
      return { id: product.id, name: product.name, sku: product.sku, sellingPrice: Number(product.sellingPrice), quantity: item.quantity, imageUrls: product.imageUrls };
    });
    return NextResponse.json({ amount, items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && ["Cart must", "One or more", "Product price", "Requested quantity"].some((prefix) => error.message.startsWith(prefix))) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: "We could not check the order amount. Please try again." }, { status: 500 });
  }
}
