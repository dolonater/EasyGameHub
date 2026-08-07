import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { glassCardBaseClass, glassTileButtonBaseClass } from "./glassClasses";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
  children?: ReactNode;
}

function joinClasses(parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function GlassCard({
  className = "",
  bordered = true,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={joinClasses([
        glassCardBaseClass,
        bordered ? "border" : "",
        className,
      ])}
      {...props}
    >
      {children}
    </div>
  );
}

interface GlassTileButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  children?: ReactNode;
}

export function GlassTileButton({
  className = "",
  selected,
  type = "button",
  children,
  ...props
}: GlassTileButtonProps) {
  const stateClass = selected === true
    ? "border-primary ring-2 ring-primary/30 shadow-md"
    : selected === false
      ? "border-border hover:border-primary/40"
      : "border-border";

  return (
    <button
      type={type}
      aria-pressed={selected === undefined ? undefined : selected}
      className={joinClasses([
        glassTileButtonBaseClass,
        stateClass,
        className,
      ])}
      {...props}
    >
      {children}
    </button>
  );
}
