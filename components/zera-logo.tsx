type ZeraWorldLogoProps = {
  variant?: "light" | "dark";
  compact?: boolean;
  className?: string;
};

export default function ZeraWorldLogo({
  variant = "dark",
  compact = false,
  className = "",
}: ZeraWorldLogoProps) {
  const textColor = variant === "dark" ? "#173B35" : "#F7F4ED";
  const accentColor = "#B38A45";
  const ringColor = variant === "dark" ? "#173B35" : "#F7F4ED";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={compact ? 28 : 42}
        height={compact ? 28 : 42}
        viewBox="0 0 64 64"
        role="img"
        aria-label="ZeraWorld logo"
      >
        <circle cx="32" cy="32" r="26" fill="none" stroke={ringColor} strokeWidth="2.5" opacity="0.9" />
        <path
          d="M18 20h28v8L27 43h19v8H18v-8l19-15H18v-8z"
          fill={accentColor}
          opacity="0.95"
        />
        <path
          d="M27 18c8-5 18-2 25 4"
          fill="none"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M12 43c8 6 18 8 30 5"
          fill="none"
          stroke={accentColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>

      <div className="leading-none">
        <div
          className="text-[1.2rem] font-black tracking-[-0.08em]"
          style={{ color: textColor, letterSpacing: compact ? "-0.08em" : "-0.1em" }}
        >
          <span className="">Zera</span>
          <span style={{ color: accentColor }}>World</span>
        </div>
        {!compact ? (
          <div className="mt-1 text-[0.58rem] font-medium uppercase tracking-[0.28em]" style={{ color: variant === "dark" ? "#5B7169" : "#EDE7DB" }}>
            Discover More. Live Better.
          </div>
        ) : null}
      </div>
    </div>
  );
}
