type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function FlowItLogo({ size = 32, withWordmark = false, className = "" }: Props) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id="flowit-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0EA5E9" />
            <stop offset="0.55" stopColor="#22D3EE" />
            <stop offset="1" stopColor="#A78BFA" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="11" fill="url(#flowit-grad)" />
        {/* Node 1 */}
        <circle cx="13" cy="13" r="3.2" fill="white" />
        {/* Node 2 */}
        <circle cx="27" cy="20" r="3.2" fill="white" />
        {/* Node 3 */}
        <circle cx="13" cy="27" r="3.2" fill="white" />
        {/* Connectors */}
        <path
          d="M15.5 14.2 Q21 14 24.5 18.2"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
        <path
          d="M24.5 21.8 Q21 26 15.5 25.8"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
          opacity="0.9"
        />
      </svg>
      {withWordmark && (
        <span
          className="font-display text-[22px] font-semibold tracking-tight text-[#0F172A]"
          style={{ fontFamily: "Outfit, ui-sans-serif, system-ui, sans-serif" }}
        >
          FlowIt
        </span>
      )}
    </div>
  );
}
