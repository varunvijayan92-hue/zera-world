import { PortalLogin } from "@/components/portal-login";
import Link from "next/link";
export default function SuppliersLoginPage() { return <><PortalLogin supplier /><p className="pb-8 text-center text-sm"><Link href="/app" className="underline">Admin and supplier app sign in</Link></p></>; }
