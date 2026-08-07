import { useTranslation } from "react-i18next";
import { COLOR_PRESETS, buildColorTheme } from "../../lib/colorThemes";
import type { Theme } from "../../lib/types";

interface ColorSwatchProps {
  onPick: (theme: Theme, presetName: string) => void;
}

export default function ColorSwatch({ onPick }: ColorSwatchProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-visible px-3">
      <div className="text-xs font-medium text-muted-foreground">
        {t("theme.colorSwatch", "Quick Color Pick")}
      </div>

      {/* Swatch row — tighter spacing, more overlap, pt for tooltip clearance */}
      <div className="flex justify-center pt-[20px] pb-1 overflow-visible">
        <div
          className="flex overflow-visible"
          style={{ transformStyle: "preserve-3d", transform: "perspective(1000px)" }}
        >
          {COLOR_PRESETS.map((preset, idx) => {
            const displayName = t(`theme.${preset.i18nKey}`, preset.name) as string;
            const isLeftEdge = idx === 0;
            const isRightEdge = idx === COLOR_PRESETS.length - 1;
            return (
              <button
                key={preset.hex}
                className="relative flex-shrink-0 w-[40px] h-[48px] -mx-[7px] bg-transparent border-none outline-none cursor-pointer transition-all duration-300 ease-out
                  hover:scale-[1.5] hover:-translate-y-[5px] hover:z-[99999]
                  active:[&::after]:translate-x-[2px] active:[&::after]:translate-y-[2px] active:[&::after]:shadow-[2px_2px_0_0_#000]
                  [&:hover+*]:scale-[1.3] [&:hover+*]:-translate-y-[3px] [&:hover+*]:z-[9999]
                  [&:hover+*+*]:scale-[1.15] [&:hover+*+*]:z-[999]
                  [&:has(+_*:hover)]:scale-[1.3] [&:has(+_*:hover)]:-translate-y-[3px] [&:has(+_*:hover)]:z-[9999]
                  [&:has(+_*+_*:hover)]:scale-[1.15] [&:has(+_*+_*:hover)]:z-[999]
                  group"
                title={displayName}
                onClick={() => onPick(buildColorTheme(preset, displayName), displayName)}
              >
                {/* Color chip */}
                <span
                  className="absolute inset-0 w-[40px] h-[40px] rounded-[6px] border-[3px] border-black dark:border-white/80 shadow-[4px_4px_0_0_#000] dark:shadow-[3px_3px_0_0_rgba(255,255,255,0.3)] transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] pointer-events-none"
                  style={{ backgroundColor: preset.hex }}
                />

                {/* Tooltip */}
                <span
                  className="absolute pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible text-[11px] tracking-[0.5px] leading-none px-[8px] py-[4px] bg-[#fef3c7] dark:bg-[#1e1b4b] text-black dark:text-white border-[2px] border-black dark:border-white/60 rounded-[4px] whitespace-nowrap z-[99999] transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
                  style={{
                    bottom: "56px",
                    ...(isLeftEdge
                      ? { left: "0", transform: "scale(0.5) translateY(10px)", transformOrigin: "bottom left" }
                      : isRightEdge
                        ? { right: "0", transform: "scale(0.5) translateY(10px)", transformOrigin: "bottom right" }
                        : { left: "50%", transform: "translateX(-50%) scale(0.5) translateY(10px)", transformOrigin: "bottom center" }
                    ),
                  }}
                >
                  {displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center -mt-0.5">
        {t("theme.colorSwatchHint", "Click a color to apply it as a new theme")}
      </p>
    </div>
  );
}
