import React from "react";
import { glassControlClass } from "./GlassSurface";

interface TabOption {
  value: string;
  label: React.ReactNode;
}

interface TabButtonsProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const sizeMap: Record<string, string> = {
  xs: "px-2 py-1 text-[11px]",
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

/**
 * Segmented tab control based on animotion tab按钮/style1.tsx.
 * Uses hidden radio inputs; the active option is highlighted in place.
 *
 * Each option sizes to its own label (whitespace-nowrap), so long labels
 * never misalign a sliding indicator. When the combined width exceeds the
 * available space the tabs wrap to a new line instead of spilling past the
 * boundary or showing a scrollbar.
 */
export default function TabButtons({
  options,
  value,
  onChange,
  name,
  size = "md",
  className = "",
}: TabButtonsProps) {
  const sizing = sizeMap[size] || sizeMap.md;

  return (
    <div
      className={`${glassControlClass} relative inline-flex max-w-full flex-wrap items-center rounded-[var(--radius)] border border-foreground/20 overflow-hidden ${className}`.trim()}
    >
      {options.map((opt) => {
        const checked = value === opt.value;
        return (
          <label
            key={opt.value}
            className={[
              "cursor-pointer flex justify-center items-center font-semibold tracking-tight select-none whitespace-nowrap transition-colors duration-150",
              sizing,
              // Exact same logic as toolbarIconClass() from lib/icons.ts.
              // The active option gets the glassy pill styling in place, so
              // there is no absolutely-positioned indicator to misalign.
              checked
                ? "app-glass-pill-indicator bg-primary text-primary-foreground rounded-md [&_img]:brightness-0 [&_img]:invert dark:[&_img]:invert-0 dark:[&_img]:brightness-100"
                : "text-foreground [&_img]:opacity-50 dark:[&_img]:opacity-60 dark:[&_img]:invert",
            ].join(" ")}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={checked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
