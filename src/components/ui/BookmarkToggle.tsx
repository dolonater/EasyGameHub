import React from "react";

interface BookmarkToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  size?: number;
  disabled?: boolean;
}

export default function BookmarkToggle({
  checked,
  onChange,
  className = "",
  size = 22,
  disabled = false,
}: BookmarkToggleProps) {
  const uid = React.useId();

  return (
    <div
      className={[
        "relative inline-flex items-center justify-center",
        disabled ? "opacity-60 pointer-events-none" : "",
        className,
      ].join(" ")}
      style={{
        ["--bm-size" as string]: `${size}px`,
        ["--bm-secondary" as string]: "hsl(var(--muted-foreground))",
        ["--bm-hover" as string]: "hsl(var(--foreground) / 0.78)",
        ["--bm-primary" as string]: "hsl(var(--primary))",
        ["--bm-circle-size" as string]: `${Math.round(size * 1.45)}px`,
        ["--bm-duration" as string]: "0.3s",
      } as React.CSSProperties}
    >
      <label htmlFor={uid} className="bm-bookmark block">
        <input
          id={uid}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
          disabled={disabled}
        />
        <span className="bm-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32">
            <g>
              <path d="M27 4v27a1 1 0 0 1-1.625.781L16 24.281l-9.375 7.5A1 1 0 0 1 5 31V4a4 4 0 0 1 4-4h14a4 4 0 0 1 4 4z" />
            </g>
          </svg>
        </span>
      </label>

      <style>{`
        .bm-bookmark {
          width: var(--bm-size);
          height: var(--bm-size);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .bm-icon {
          width: var(--bm-size);
          height: auto;
          fill: var(--bm-secondary);
          cursor: pointer;
          transition: 0.2s;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          transform-origin: top;
        }

        .bm-icon::after {
          content: "";
          position: absolute;
          width: 10px;
          height: 10px;
          box-shadow:
            0 30px 0 -4px var(--bm-primary),
            30px 0 0 -4px var(--bm-primary),
            0 -30px 0 -4px var(--bm-primary),
            -30px 0 0 -4px var(--bm-primary),
            -22px 22px 0 -4px var(--bm-primary),
            -22px -22px 0 -4px var(--bm-primary),
            22px -22px 0 -4px var(--bm-primary),
            22px 22px 0 -4px var(--bm-primary);
          border-radius: 50%;
          transform: scale(0);
        }

        .bm-icon::before {
          content: "";
          position: absolute;
          border-radius: 50%;
          border: 1px solid var(--bm-primary);
          opacity: 0;
        }

        .bm-bookmark:hover .bm-icon {
          fill: var(--bm-hover);
        }

        .bm-bookmark input:focus-visible + .bm-icon {
          outline: 2px solid hsl(var(--primary) / 0.28);
          outline-offset: 4px;
          border-radius: 4px;
        }

        .bm-bookmark input:checked + .bm-icon::after {
          animation: bm-circles var(--bm-duration) cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          animation-delay: var(--bm-duration);
        }

        .bm-bookmark input:checked + .bm-icon {
          fill: var(--bm-primary);
          animation: bm-bookmark var(--bm-duration) forwards;
          transition-delay: 0.3s;
        }

        .bm-bookmark input:checked + .bm-icon::before {
          animation: bm-circle var(--bm-duration) cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
          animation-delay: var(--bm-duration);
        }

        @keyframes bm-bookmark {
          50% { transform: scaleY(0.6); }
          100% { transform: scaleY(1); }
        }

        @keyframes bm-circle {
          from {
            width: 0;
            height: 0;
            opacity: 0;
          }
          90% {
            width: var(--bm-circle-size);
            height: var(--bm-circle-size);
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        @keyframes bm-circles {
          from { transform: scale(0); }
          40% { opacity: 1; }
          to {
            transform: scale(0.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
