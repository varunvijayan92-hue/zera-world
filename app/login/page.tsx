import { PortalLogin } from "@/components/portal-login";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <PortalLogin next={next === "/checkout/payment" ? next : undefined} />;
}
