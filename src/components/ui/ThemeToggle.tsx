import React from "react";

interface ThemeToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}

/**
 * Dark/light mode toggle based on animotion 浅深色模式切换按钮/style1.tsx.
 * 100×50px, moon crescent → full circle animation via inset box-shadow.
 */
export default function ThemeToggle({ checked, onChange, className = "" }: ThemeToggleProps) {
  return (
    <div className={`relative w-[100px] h-[50px] ${className}`.trim()}>
      <label
        className="absolute w-full h-[50px] bg-[#28292c] rounded-[25px] cursor-pointer border-[3px] border-[#28292c]"
        style={{ boxSizing: "border-box" }}
      >
        <input
          type="checkbox"
          className="absolute hidden"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {/* slider background — becomes light when checked */}
        <span
          className="absolute w-full h-full rounded-[25px] transition-[0.3s]"
          style={{ backgroundColor: checked ? "#d8dbe0" : "transparent" }}
        />
        {/* slider knob with moon-crescent shadow — matches ::before in reference */}
        <span
          className="absolute top-[10px] left-[10px] w-[25px] h-[25px] rounded-full bg-[#28292c] transition-[0.3s]"
          style={{
            transform: checked ? "translateX(50px)" : "translateX(0)",
            boxShadow: checked
              ? "none"
              : "inset 12px -4px 0px 0px #d8dbe0",
          }}
        />
      </label>
    </div>
  );
}
