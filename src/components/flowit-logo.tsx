import chillitLogo from "@/assets/chillit-logo.svg";

type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function FlowItLogo({ size = 32, className = "" }: Props) {
  // SVG logo with wordmark baked-in (aspect ~4:1). `size` controls height.
  return (
    <img
      src={chillitLogo}
      alt="chill it"
      style={{ height: size, width: "auto" }}
      draggable={false}
      className={`select-none ${className}`}
    />
  );
}
