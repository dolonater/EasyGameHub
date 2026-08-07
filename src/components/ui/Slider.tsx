import React from "react";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

export default function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  className = "",
}: SliderProps) {
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <label
      className={[
        "inline-flex w-full cursor-pointer items-center",
        "[--slider-height:6px] [--slider-fill:hsl(var(--primary))] [--slider-track:hsl(var(--border)/0.88)] [--slider-track-hover:hsl(var(--primary)/0.2)] [--slider-ring:hsl(var(--primary)/0.18)] [--slider-outline:hsl(var(--border)/0.9)]",
        className,
      ].join(" ")}
    >
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="app-glass-slider slider-level h-[var(--slider-height)] w-full cursor-pointer appearance-none rounded-full bg-[var(--slider-track)] shadow-[inset_0_0_0_1px_var(--slider-outline)] transition-[height,box-shadow,background] duration-150 hover:h-[calc(var(--slider-height)*2)] hover:bg-[var(--slider-track-hover)] hover:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.32)] focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--slider-ring),inset_0_0_0_1px_hsl(var(--primary)/0.4)] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 [&::-moz-range-thumb]:w-0 [&::-moz-range-thumb]:h-0 [&::-moz-range-thumb]:border-0"
        style={{
          background: `linear-gradient(to right, var(--slider-fill) 0%, var(--slider-fill) ${percent}%, var(--slider-track) ${percent}%, var(--slider-track) 100%)`,
        }}
      />
    </label>
  );
}
