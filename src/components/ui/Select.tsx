import React, { useState, useRef, useEffect } from "react";
import Icon from "./Icon";
import { glassControlClass, glassMenuItemClass, GlassMenuPanel } from "./GlassSurface";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  className?: string;
}

/**
 * Click-to-open dropdown select based on animotion 下拉筛选框/style1.tsx.
 */
export default function Select({
  options,
  value,
  onChange,
  name,
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label || options[0]?.label || "";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    // 打开时把容器 z-index 提到最高，避免多个下拉垂直排列时被后面容器（同为 z-100）遮挡面板
    <div ref={ref} className={`relative select-none w-fit ${open ? "z-[200]" : "z-[100]"} ${className}`.trim()}>
      <div
        onClick={() => setOpen(!open)}
        data-open={open ? "true" : "false"}
        className={`${glassControlClass} flex items-center justify-between gap-2 border border-foreground/20 px-3 py-[5px] rounded text-xs cursor-pointer min-w-[100px] text-foreground`}
      >
        <span>{selectedLabel}</span>
        <Icon
          name="chevronDown"
          size={12}
          className={`text-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </div>

      {/* Dropdown — always rendered for smooth enter/exit animation */}
      <GlassMenuPanel
        className={[
          "absolute top-full mt-1 w-full flex flex-col gap-0.5 rounded border border-foreground/10 p-1 shadow-lg z-[110]",
          // 选项过多时限制高度并滚动（约 10 行），避免撑开页面滚动区域
          "max-h-[286px] overflow-y-auto",
          "transition-all duration-300 ease-out",
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-1 pointer-events-none",
        ].join(" ")}
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { onChange(opt.value); setOpen(false); }}
            className={[
              `${glassMenuItemClass} text-left rounded px-3 py-[5px] text-xs transition-colors duration-300`,
              "text-foreground hover:bg-secondary",
              value === opt.value ? "bg-secondary font-medium" : "",
            ].join(" ")}
          >
            {opt.label}
          </button>
        ))}
      </GlassMenuPanel>
    </div>
  );
}
