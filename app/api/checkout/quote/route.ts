import { cashOnDeliveryAvailable } from "@/lib/cash-on-delivery";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { priceCheckout } from "@/lib/checkout";
import { checkoutRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = checkoutRequestSchema.pick({ cart: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Please check the items and quantities in your order." }, { status: 400 });
  try {
    const products = await prisma.product.findMany({
      where: { id: { in: parsed.data.cart.map((item) => item.productId) } }, include: { supplier: { select: { status: true, sourceType: true } }, inventory: { where: { status: "AVAILABLE" } } },
    });
    const amount = priceCheckout(parsed.data.cart, products);
    const items = parsed.data.cart.map((item) => {
      const product = products.find((entry) => entry.id === item.productId)!;
      const mapping = product.colorImages && typeof product.colorImages === "object" && !Array.isArray(product.colorImages) ? product.colorImages as Record<string, unknown> : {};
      const selectedImage = item.selectedColor && typeof mapping[item.selectedColor] === "string" && product.imageUrls.includes(mapping[item.selectedColor] as string) ? mapping[item.selectedColor] as string : null;
      const imageUrls = selectedImage ? [selectedImage, ...product.imageUrls.filter(url => url !== selectedImage)] : product.imageUrls;
      return { id: product.id, name: product.name, sku: product.sku, selectedColor: item.selectedColor, selectedSize: item.selectedSize, sellingPrice: Number(product.sellingPrice), quantity: item.quantity, imageUrls };
    });
    return NextResponse.json({ amount, items, codAvailable: cashOnDeliveryAvailable(products) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && ["Cart must", "One or more", "Product price", "Requested quantity"].some((prefix) => error.message.startsWith(prefix))) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN";
    console.error(JSON.stringify({ event: "checkout_quote_failed", code }));
    return NextResponse.json({ message: "We could not check the order amount. Please try again." }, { status: 500 });
  }
}
