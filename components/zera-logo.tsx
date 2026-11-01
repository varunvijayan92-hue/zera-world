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
  const leafColor = "#6F8E68";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={compact ? 42 : 64}
        height={compact ? 42 : 64}
        viewBox="0 0 100 100"
        role="img"
        aria-label="ZeraWorld logo"
        className="shrink-0"
      >
        <path
          d="M20 18c15-12 39-12 57 3-7 5-15 8-23 10-15 4-25 15-31 31l-18-8c7-19 9-25 15-36Z"
          fill={leafColor}
          opacity="0.96"
        />
        <path
          d="M26 58c14 2 26-5 33-17-10 7-21 12-36 9l3 8Z"
          fill={accentColor}
          opacity="0.95"
        />
        <path
          d="M42 16v52h-12V16h12Zm0 0h18c13 0 19 7 19 17s-6 17-19 17H42"
          fill={textColor}
          opacity="0.98"
        />
        <path
          d="M24 16c4 32 18 43 39 56"
          fill="none"
          stroke={accentColor}
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.8"
        />
        <path d="M12 68c7-4 12-7 17-9" fill="none" stroke={leafColor} strokeWidth="4" strokeLinecap="round" opacity="0.8" />
        <path d="M68 14c8 7 18 14 27 13" fill="none" stroke={leafColor} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      </svg>

      <div className="leading-none">
        <div
          className="whitespace-nowrap font-black italic tracking-[-0.08em]"
          style={{
            color: textColor,
            fontFamily: '"Segoe Print", "Bradley Hand", "Lucida Handwriting", cursive',
            fontSize: compact ? "1.7rem" : "3.2rem",
            lineHeight: 0.9,
            letterSpacing: "-0.08em",
          }}
        >
          Zera&apos;s World
        </div>

        <svg
          viewBox="0 0 320 24"
          className="mt-1 block w-full max-w-[260px]"
          aria-hidden="true"
          style={{ overflow: "visible" }}
        >
          <path
            d="M8 16C52 1 97 1 132 8C158 13 180 15 206 13C229 11 265 3 312 12"
            fill="none"
            stroke={accentColor}
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
