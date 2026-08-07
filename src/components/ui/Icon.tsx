import type { CSSProperties } from "react";
import { ICONS, type IconName } from "../../lib/icons";

interface IconProps {
  name: IconName;
  className?: string;
  size?: number | string;
  title?: string;
}

export default function Icon({ name, className = "", size = 20, title }: IconProps) {
  const svg = ICONS[name];
  const style: CSSProperties = {
    width: typeof size === "number" ? `${size}px` : size,
    height: typeof size === "number" ? `${size}px` : size,
  };

  return (
    <span
      className={[
        "inline-flex shrink-0 items-center justify-center leading-none",
        "[&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:fill-current [&_svg]:stroke-current",
        className,
      ].join(" ")}
      style={style}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
