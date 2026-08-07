import React, { useRef } from "react";
import GlassCard from "./GlassCard";
import { glassControlClass } from "./GlassSurface";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  /** Text above the inputs */
  label?: string;
  /** Confirm button text */
  confirmLabel?: string;
}

/**
 * Theme-adaptive OTP digit input based on animotion staem验证码/style1.tsx.
 * Individual digit boxes with auto-advance, backdrop blur card.
 */
export default function OtpInput({
  length = 5,
  value,
  onChange,
  onSubmit,
  disabled = false,
  label,
  confirmLabel = "Verify",
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (i: number, ch: string) => {
    const char = ch.slice(-1);
    const arr = value.padEnd(length, "").split("");
    arr[i] = char;
    const next = arr.join("").trimEnd();
    onChange(next);
    // Auto-advance
    if (char && i < length - 1) {
      inputRefs.current[i + 1]?.focus();
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputRefs.current[i - 1]?.focus();
    }
    if (e.key === "Enter" && value.trim().length >= length && onSubmit) {
      onSubmit();
    }
  };

  return (
    <GlassCard
      className="mx-auto flex w-[17em] min-h-[12em] flex-col gap-[10px] rounded-[10px] border border-slate-200/90 shadow-[0_8px_30px_rgba(15,23,42,0.12)] dark:border-white/35 dark:shadow-[0_8px_30px_rgba(0,0,0,0.22)]"
    >
      <div className="my-auto flex flex-col gap-[10px] px-4 py-5">
        {label && (
          <p className="text-center text-sm font-bold text-slate-700 dark:text-white">{label}</p>
        )}
        <div className="mx-auto flex gap-[0.5em]">
          {Array.from({ length }, (_, i) => {
            const filled = !!value[i];
            return (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                maxLength={1}
                type="text"
                placeholder=""
                value={value[i] || ""}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={[
                  "h-[2em] w-[2em] rounded-[5px] border text-center text-lg outline-none placeholder:opacity-0 transition-all duration-[0.35s]",
                  filled
                    ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-[#333]"
                    : `${glassControlClass} border-slate-300 text-slate-700 focus:border-primary/60 dark:border-white/60 dark:text-white dark:focus:border-white`,
                ].join(" ")}
              />
            );
          })}
        </div>
        {onSubmit && (
          <button
            onClick={onSubmit}
            disabled={disabled}
            className="app-surface app-glass-button mx-auto h-[2.3em] w-[8.5em] rounded-[5px] border border-slate-300 text-sm text-slate-700 transition-all duration-[0.35s] hover:border-slate-900 hover:bg-slate-900 hover:text-white disabled:opacity-50 dark:border-white/70 dark:text-white dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
          >
            {confirmLabel}
          </button>
        )}
      </div>
    </GlassCard>
  );
}
