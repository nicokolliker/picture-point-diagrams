import { Shuffle } from "lucide-react";
import chillitLogo from "@/assets/chillit-logo.svg";

type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function FlowItLogo({ size = 32, className = "" }: Props) {
  return (
    <div className={`flex select-none items-center gap-2 ${className}`}>
      <span
        className="inline-flex items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-sm"
        style={{ width: size * 0.95, height: size * 0.95 }}
      >
        <Shuffle style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2.5} />
      </span>
      <img
        src={chillitLogo}
        alt="chill it"
        style={{ height: size * 0.78, width: "auto" }}
        draggable={false}
      />
    </div>
  );
}
