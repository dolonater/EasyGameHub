import React from "react";

type CheckboxColor = "blue" | "green" | "purple" | "red";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  color?: CheckboxColor;
  id?: string;
}

const colorVars: Record<CheckboxColor, string> = {
  blue:   "[--ck-color:#3b82f6] [--ck-bg:#dbeafe] [--ck-border:#93c5fd]",
  green:  "[--ck-color:#10b981] [--ck-bg:#d1fae5] [--ck-border:#6ee7b7]",
  purple: "[--ck-color:#8b5cf6] [--ck-bg:#ede9fe] [--ck-border:#c4b5fd]",
  red:    "[--ck-color:#ef4444] [--ck-bg:#fee2e2] [--ck-border:#fca5a5]",
};

/**
 * iOS-style checkbox based on animotion Checkboxes/style1.tsx.
 * Animated checkmark with bounce, color themes (blue/green/purple/red).
 */
export default function Checkbox({ checked, onChange, color = "blue", id }: CheckboxProps) {
  const uid = id || React.useId();

  return (
    <label
      className={[
        "relative inline-block cursor-pointer select-none",
        "[--ck-size:19px]",
        colorVars[color],
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only ck-input"
        id={uid}
      />
      <span
        className={[
          "relative block w-[var(--ck-size)] h-[var(--ck-size)] rounded-lg",
          "transition-transform duration-200",
          "hover:scale-105 active:scale-95",
        ].join(" ")}
      >
        <span
          className={[
            "app-glass-control absolute inset-0 rounded-lg border-2 bg-white transition-all duration-200",
            checked
              ? "border-[var(--ck-color)] !bg-[var(--ck-color)]"
              : "border-[var(--ck-border)]",
          ].join(" ")}
        />
        <svg
          fill="none" viewBox="0 0 24 24"
          className={[
            "absolute inset-0 m-auto w-[80%] h-[80%] text-white transition-all duration-200",
            checked ? "scale-100" : "scale-0",
          ].join(" ")}
        >
          <path
            strokeLinejoin="round" strokeLinecap="round" strokeWidth={3}
            stroke="currentColor"
            d="M4 12L10 18L20 6"
            className={checked ? "animate-[ck-draw_0.3s_ease_0.1s_forwards]" : ""}
            style={checked ? undefined : { strokeDasharray: 40, strokeDashoffset: 40 }}
          />
        </svg>
      </span>
    </label>
  );
}
