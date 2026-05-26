import { Shuffle } from "lucide-react";
import chillitLogo from "@/assets/chillit-logo.svg";

type Props = {
  size?: number;
  className?: string;
};

/**
 * Chill It wordmark with a small gradient Shuffle accent on the left.
 * Designed for a 232px sidebar column. The Shuffle glyph sits inside a
 * soft, low-contrast circle so the Chill It wordmark stays dominant.
 */
export function FlowItLogo({ size = 34, className = "" }: Props) {
  const ringSize = Math.round(size * 0.86);
  const iconSize = Math.round(size * 0.42);
  const wordmarkHeight = Math.round(size * 0.92);

  return (
    <div
      aria-label="Chill It"
      role="img"
      className={`flex select-none items-center gap-2.5 ${className}`}
    >
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-50 to-violet-50 ring-1 ring-sky-200/70"
        style={{ width: ringSize, height: ringSize }}
      >
        <Shuffle
          className="text-transparent"
          style={{
            width: iconSize,
            height: iconSize,
            stroke: "url(#flowit-logo-grad)",
          }}
          strokeWidth={2.4}
        />
        {/* gradient definition for the stroke */}
        <svg width="0" height="0" className="absolute" aria-hidden="true">
          <defs>
            <linearGradient id="flowit-logo-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
          </defs>
        </svg>
      </span>
      <img
        src={chillitLogo}
        alt="chill it"
        style={{
          height: wordmarkHeight,
          width: "auto",
          // Optical alignment: nudge baseline a hair so the wordmark sits on
          // the same x-height as the icon center.
          transform: "translateY(1px)",
        }}
        draggable={false}
      />
    </div>
  );
}
