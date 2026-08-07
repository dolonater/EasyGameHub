import React from "react";

interface ToggleProps {
  on: boolean;
  onChange: (on: boolean) => void;
  id?: string;
}

/**
 * Toggle switch based on animotion 切换按钮/style1.tsx.
 */
export default function Toggle({ on, onChange, id }: ToggleProps) {
  const uid = id || React.useId();

  return (
    <div className="relative inline-block w-[42px] h-[22px]">
      <input
        id={uid}
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <label
        htmlFor={uid}
        className={[
          "app-glass-toggle-track absolute inset-0 overflow-hidden rounded-[11px] cursor-pointer transition-all duration-300 border",
          on
            ? "bg-primary/20 border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]"
            : "bg-muted/80 border-border",
        ].join(" ")}
      >
        <span
          className={[
            "app-glass-toggle-thumb absolute left-[2px] top-[1px] w-[18px] h-[18px] rounded-full shadow-md transition-all duration-300 border",
            on
              ? "translate-x-[20px] bg-primary border-primary/70"
              : "translate-x-0 bg-background border-foreground/12",
          ].join(" ")}
        />
      </label>
    </div>
  );
}
