import { NavLink } from "react-router-dom";
import type { ComponentProps, ReactNode } from "react";
import Icon from "./Icon";
import { glassFloatingClass } from "./GlassSurface";

interface HorizontalNavBarProps {
  children: ReactNode;
  className?: string;
}

interface HorizontalNavItemProps {
  icon: ComponentProps<typeof Icon>["name"];
  iconClass: string;
  label: ReactNode;
  to?: string;
  end?: boolean;
  active?: boolean;
  placement: "top" | "bottom";
  onClick?: () => void;
}

function labelToTitle(label: ReactNode) {
  return typeof label === "string" ? label : "";
}

function tooltipClass(placement: "top" | "bottom") {
  const base = [
    "pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 scale-0 whitespace-nowrap rounded-lg border border-border",
    "bg-background px-3 py-1.5 text-xs font-medium text-foreground shadow-lg",
    "transition-all duration-200 ease-out group-hover:scale-100",
  ];
  if (placement === "top") {
    return [
      ...base,
      "top-[calc(100%+0.5rem)] origin-top",
      "before:absolute before:left-1/2 before:top-[-5px] before:-translate-x-1/2 before:border-[6px] before:border-transparent before:border-b-background",
    ].join(" ");
  }
  return [
    ...base,
    "bottom-[calc(100%+0.5rem)] origin-bottom",
    "before:absolute before:bottom-[-5px] before:left-1/2 before:-translate-x-1/2 before:border-[6px] before:border-transparent before:border-t-background",
  ].join(" ");
}

function itemClass(active: boolean) {
  return [
    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors duration-200",
    active
      ? "bg-primary text-primary-foreground shadow-md"
      : "text-foreground/65 hover:bg-primary/10 hover:text-primary",
  ].join(" ");
}

export function HorizontalNavBar({ children, className = "" }: HorizontalNavBarProps) {
  return (
    <div
      className={[
        glassFloatingClass,
        "pointer-events-auto flex h-full min-w-0 items-center gap-0 overflow-visible rounded-xl border border-border/70",
        "px-2 py-1.5 shadow-lg transition-all duration-200 hover:shadow-xl",
        className,
      ].join(" ").trim()}
    >
      {children}
    </div>
  );
}

export function HorizontalNavItem({
  icon,
  iconClass,
  label,
  to,
  end,
  active = false,
  placement,
  onClick,
}: HorizontalNavItemProps) {
  const title = labelToTitle(label);
  const content = (
    <>
      <div className={itemClass(active)}>
        <Icon
          name={icon}
          size={20}
          className={[
            "transition-transform duration-200 group-hover:scale-110",
            active ? "text-primary-foreground" : iconClass,
          ].join(" ")}
        />
      </div>
      {title && <span className={tooltipClass(placement)}>{title}</span>}
    </>
  );

  if (to) {
    return (
      <NavLink
        to={to}
        end={end}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        aria-label={title}
        className="group relative flex flex-none cursor-pointer px-1"
      >
        {({ isActive }) => (
          <>
            <div className={itemClass(isActive)}>
              <Icon
                name={icon}
                size={20}
                className={[
                  "transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-primary-foreground" : iconClass,
                ].join(" ")}
              />
            </div>
            {title && <span className={tooltipClass(placement)}>{title}</span>}
          </>
        )}
      </NavLink>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className="group relative flex flex-none cursor-pointer px-1"
    >
      {content}
    </button>
  );
}
