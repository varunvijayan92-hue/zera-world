import Image from "next/image";
type ZeraWorldLogoProps = { variant?: "light" | "dark"; compact?: boolean; className?: string };
export default function ZeraWorldLogo({ compact = false, className = "" }: ZeraWorldLogoProps) {
  return <Image src="/branding/zera-botanical-logo.png" alt="Zera's World" width={2172} height={724} priority className={`${compact ? "w-[210px] sm:w-[270px]" : "w-[330px]"} h-auto max-w-full rounded-sm ${className}`} />;
}
