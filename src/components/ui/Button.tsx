import React from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  ripple?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "app-glass-button bg-primary text-primary-foreground border border-primary",
  secondary: "app-surface app-glass-button text-foreground border border-border",
  danger: "app-glass-button bg-red-600 text-white border border-red-600",
  outline: "app-surface app-glass-button border border-foreground/20 bg-transparent text-foreground",
  ghost: "app-glass-button border border-transparent bg-transparent text-foreground",
};

const hoverClasses: Record<ButtonVariant, string> = {
  primary: "hover:bg-primary/90 hover:shadow-inner",
  secondary: "hover:bg-primary/10 hover:shadow-inner",
  danger: "hover:bg-red-600/90 hover:shadow-inner",
  outline: "hover:bg-primary/10 hover:shadow-inner",
  ghost: "hover:bg-primary/10 hover:shadow-inner",
};

const rippleColors: Record<ButtonVariant, string> = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--card))",
  danger: "#dc2626",
  outline: "",
  ghost: "",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

const baseClasses = [
  "inline-flex items-center justify-center gap-1.5 rounded-[var(--radius)] font-medium transition-all duration-200",
  "disabled:opacity-50 disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none",
].join(" ");

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  style,
  children,
  ripple = false,
  ...props
}: ButtonProps) {
  const enableRipple = ripple && variant !== "danger";

  return (
    <button
      type="button"
      className={[
        enableRipple ? "btn-ripple" : "btn-no-ripple",
        baseClasses,
        sizeClasses[size],
        variantClasses[variant],
        hoverClasses[variant],
        className,
      ].join(" ")}
      style={{
        ...(enableRipple && rippleColors[variant] ? { "--btn-ripple": rippleColors[variant] } as React.CSSProperties : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
