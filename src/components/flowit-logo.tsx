import chillitLogo from "@/assets/chillit-logo.png";

type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

export function FlowItLogo({ size = 32, withWordmark = false, className = "" }: Props) {
  // The chill it logo is highly horizontal (~roughly 4.5:1). When used as an
  // icon-only mark we render a square crop; with wordmark we let it breathe.
  const height = size;
  const width = withWordmark ? Math.round(size * 4.5) : Math.round(size * 1.2);
  return (
    <div className={`inline-flex items-center ${className}`}>
      <img
        src={chillitLogo}
        alt="chill it"
        width={width}
        height={height}
        style={{ height, width: "auto", objectFit: "contain" }}
        draggable={false}
      />
    </div>
  );
}
