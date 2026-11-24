import { PortalLogin } from "@/components/portal-login";
import { getCurrentUser } from "@/lib/auth";
import { integrationCredentials } from "@/lib/integration-settings";
import { redirect } from "next/navigation";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const destination = next === "/checkout" || next === "/checkout/payment" ? next : undefined;
  const user = await getCurrentUser();
  if (user?.role === "CUSTOMER" && destination) redirect(destination);
  const whatsappSignup = await integrationCredentials("META_WHATSAPP").then(settings => settings.signupOtpEnabled === "true", () => false);
  return <PortalLogin next={destination} whatsappSignup={whatsappSignup} />;
}
