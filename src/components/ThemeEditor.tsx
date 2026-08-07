import { useState, useMemo, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { Theme, ThemeVariant } from "../lib/types";
import { useAnimation } from "../hooks/useAnimation";
import { Button, GlassFloating, glassControlClass, Icon } from "./ui";

// ── Constants ─────────────────────────────────────────────────────

const VAR_ORDER: (keyof ThemeVariant)[] = [
  "background", "foreground",
  "card", "cardForeground",
  "primary", "primaryForeground",
  "secondary", "secondaryForeground",
  "muted", "mutedForeground",
  "accent", "accentForeground",
  "destructive", "destructiveForeground",
  "border", "input", "ring",
];

const VAR_I18N_KEYS: Record<string, string> = {
  background: "theme.varBackground",
  foreground: "theme.varForeground",
  card: "theme.varCard",
  cardForeground: "theme.varCardForeground",
  primary: "theme.varPrimary",
  primaryForeground: "theme.varPrimaryForeground",
  secondary: "theme.varSecondary",
  secondaryForeground: "theme.varSecondaryForeground",
  muted: "theme.varMuted",
  mutedForeground: "theme.varMutedForeground",
  accent: "theme.varAccent",
  accentForeground: "theme.varAccentForeground",
  destructive: "theme.varDestructive",
  destructiveForeground: "theme.varDestructiveForeground",
  border: "theme.varBorder",
  input: "theme.varInput",
  ring: "theme.varRing",
};

// ── HSL helpers ───────────────────────────────────────────────────

function parseHsl(raw: string): [number, number, number] {
  const parts = raw.split(/\s+/);
  const h = parseFloat(parts[0]) || 0;
  const s = parseFloat(parts[1]) || 0;
  const l = parseFloat(parts[2]) || 0;
  return [h, s, l];
}

function formatHsl(h: number, s: number, l: number): string {
  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const a = sNorm * Math.min(lNorm, 1 - lNorm);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return lNorm - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const r = parseInt(m[1].slice(0, 2), 16) / 255;
  const g = parseInt(m[1].slice(2, 4), 16) / 255;
  const b = parseInt(m[1].slice(4, 6), 16) / 255;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const delta = maxC - minC;
  const l = (maxC + minC) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (delta !== 0) {
    if (maxC === r) h = ((g - b) / delta) % 6;
    else if (maxC === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return [h, Math.round(s * 100), Math.round(l * 100)];
}

// ── Slider sub-component ──────────────────────────────────────────

function HslSlider({ label, value, min, max, step, onChange, gradientLeft, gradientRight }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  gradientLeft?: string; gradientRight?: string;
}) {
  const bg = gradientLeft && gradientRight
    ? `linear-gradient(to right, ${gradientLeft}, ${gradientRight})`
    : undefined;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-3">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded appearance-none cursor-pointer"
        style={{ background: bg || undefined }}
      />
      <input
        type="number" min={min} max={max} step={step} value={Math.round(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${glassControlClass} w-12 px-1 py-0.5 border rounded text-[10px] text-center`}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

interface Props {
  open: boolean;
  theme: Theme | null;
  onSave: (theme: Theme) => void;
  onClose: () => void;
}

export default function ThemeEditor({ open, theme, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const anim = useAnimation();
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [name, setName] = useState("");
  const [previewMode, setPreviewMode] = useState<"light" | "dark">("light");
  const [selectedVar, setSelectedVar] = useState<string | null>(null);
  const [localTheme, setLocalTheme] = useState<Theme | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // ── Open / close lifecycle ──────────────────────────────────

  useEffect(() => {
    if (open && theme) {
      setMounted(true);
      setClosing(false);
      setName(theme.name);
      setLocalTheme(structuredClone(theme));
      setSelectedVar(null);
      setPopoverAnchor(null);
    } else if (mounted) {
      setClosing(true);
      const timer = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(timer);
    }
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mounted]);

  // ── Close popover on body scroll ─────────────────────────────

  const closePopover = useCallback(() => {
    setSelectedVar(null);
    setPopoverAnchor(null);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.addEventListener("scroll", closePopover, { passive: true });
    return () => el.removeEventListener("scroll", closePopover);
  }, [mounted, closePopover]);

  // ── Popover position ─────────────────────────────────────────

  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!popoverAnchor) {
      setPopoverStyle(null);
      return;
    }
    const popoverW = 300;
    const popoverH = 210; // approximate
    let top = popoverAnchor.top - popoverH - 10;
    let left = popoverAnchor.left + popoverAnchor.width / 2 - popoverW / 2;

    // If not enough room above, show below
    if (top < 16) top = popoverAnchor.bottom + 10;
    // Clamp horizontally
    left = Math.max(8, Math.min(left, window.innerWidth - popoverW - 8));

    setPopoverStyle({ top, left });
  }, [popoverAnchor]);

  const handleClose = () => {
    if (!anim) {
      onClose();
      return;
    }
    setClosing(true);
    setTimeout(() => onClose(), 150);
  };

  // ── All hooks must be called before any early return ─────────

  const previewCss = useMemo(() => {
    if (!localTheme) return {};
    const variant = previewMode === "dark" ? localTheme.dark : localTheme.light;
    const vars: Record<string, string> = {};
    const v = variant as unknown as Record<string, string>;
    for (const key of VAR_ORDER) {
      if (key in v) vars[`--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`] = v[key];
    }
    return vars;
  }, [localTheme, previewMode]);

  if (!mounted || !localTheme) return null;

  // ── Theme editing logic ─────────────────────────────────────

  const previewVariant = previewMode === "dark" ? localTheme.dark : localTheme.light;
  const v = previewVariant as unknown as Record<string, string>;

  function updateVar(key: string, h: number, s: number, l: number) {
    const val = formatHsl(h, s, l);
    setLocalTheme((prev) => {
      if (!prev) return prev;
      const variant = { ...(prev[previewMode] as unknown as Record<string, string>) };
      variant[key] = val;
      return { ...prev, [previewMode]: variant as unknown as ThemeVariant };
    });
  }

  function handleSave() {
    if (!localTheme) return;
    onSave({ ...localTheme, name: name.trim() || localTheme.name });
  }

  function varLabel(key: string): string {
    const i18nKey = VAR_I18N_KEYS[key];
    return i18nKey ? t(i18nKey) : key;
  }

  // ── Selected var editor state ────────────────────────────────

  const selRaw = selectedVar ? (v[selectedVar] || "0 0% 0%") : "0 0% 0%";
  const [selH, selS, selL] = parseHsl(selRaw);
  const selHex = hslToHex(selH, selS, selL);

  const dialog = (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-4 py-6 soft-backdrop ${
        anim ? (closing ? "animate-fade-out" : "animate-fade-in") : ""
      }`}
      onClick={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <GlassFloating
        className={`relative flex w-[min(700px,calc(100vw-32px))] max-h-[88vh] flex-col overflow-hidden rounded-[24px] shadow-[20px_20px_30px_rgba(0,0,0,0.068)] ${
          anim ? (closing ? "animate-fade-out" : "animate-scale-in") : ""
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
          aria-label={t("common.close")}
        >
          <Icon name="close" size={18} className="text-current" />
        </button>

        {/* Header */}
        <div className="border-b border-border/60 px-5 py-4 pr-16">
          <h2 className="font-semibold">{t("theme.editTheme")}</h2>
        </div>

        {/* Scrollable body */}
        <div ref={bodyRef} className="app-scrollbar flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Row: Name + Light/Dark toggle */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-muted-foreground mb-1">{t("theme.name")}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className={`${glassControlClass} w-full px-3 py-1.5 border rounded text-sm`} />
            </div>
            <div className="flex border rounded overflow-hidden">
              <button onClick={() => setPreviewMode("light")}
                className={`px-3 py-1.5 text-xs ${previewMode === "light" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                {t("theme.light")}
              </button>
              <button onClick={() => setPreviewMode("dark")}
                className={`px-3 py-1.5 text-xs ${previewMode === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-secondary"}`}>
                {t("theme.dark")}
              </button>
            </div>
          </div>

          {/* Mock preview */}
          <div className="border rounded-xl p-4 space-y-3" style={previewCss as React.CSSProperties}>
            {/* Top bar */}
            <div className="h-7 rounded-md flex items-center px-3" style={{ background: `hsl(${v.background})` }}>
              <span className="text-[10px] font-medium" style={{ color: `hsl(${v.foreground})` }}>
                {t("theme.preview")}
              </span>
            </div>
            {/* Card */}
            <div className="rounded-lg p-3" style={{ background: `hsl(${v.card})` }}>
              <div className="text-xs font-semibold" style={{ color: `hsl(${v.cardForeground})` }}>{t("theme.cardTitle")}</div>
              <div className="text-[10px] mt-1" style={{ color: `hsl(${v.mutedForeground})` }}>{t("theme.descriptionText")}</div>
              <div className="mt-2 px-3 py-1 rounded-md text-[10px] inline-block"
                style={{ background: `hsl(${v.primary})`, color: `hsl(${v.primaryForeground})` }}>
                {t("theme.button")}
              </div>
            </div>
            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-1.5 border rounded-lg text-[10px]"
              style={{ borderColor: `hsl(${v.border})`, background: `hsl(${v.input})` }}>
              <span style={{ color: `hsl(${v.mutedForeground})` }}>{t("theme.inputPlaceholder")}</span>
            </div>
            {/* Color chips row */}
            <div className="flex gap-1.5">
              {(["secondary", "accent", "destructive", "muted"] as const).map((chip) => (
                <div key={chip} className="px-2 py-0.5 rounded-full text-[9px]"
                  style={{ background: `hsl(${v[chip]})`, color: `hsl(${v[`${chip}Foreground` as keyof ThemeVariant] || v.foreground})` }}>
                  {varLabel(chip).split(" ")[0]}
                </div>
              ))}
            </div>
          </div>

          {/* Color grid */}
          <div>
            <span className="text-[10px] font-medium text-muted-foreground">{t("theme.colors")}</span>
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {VAR_ORDER.map((key) => {
                const raw = v[key as string] || "0 0% 0%";
                const [h, s, l] = parseHsl(raw);
                const hex = hslToHex(h, s, l);
                const isSel = selectedVar === key;

                return (
                  <button
                    key={key}
                    onClick={(e) => {
                      if (isSel) {
                        closePopover();
                      } else {
                        setSelectedVar(key);
                        setPopoverAnchor(e.currentTarget.getBoundingClientRect());
                      }
                    }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
                      isSel
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-secondary/30"
                    }`}
                  >
                    <div
                      className="w-10 h-10 rounded-lg border border-white/10 shadow-sm"
                      style={{ background: hex }}
                    />
                    <span className="text-[10px] leading-tight text-center">{varLabel(key as string)}</span>
                    <span className="text-[9px] text-muted-foreground font-mono">{hex}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="border-t border-border/60 px-5 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose}>{t("common.cancel")}</Button>
          <Button variant="primary" onClick={handleSave}>{t("common.save")}</Button>
        </div>
      </GlassFloating>
    </div>
  );

  const popover = selectedVar && popoverStyle && (
    <div
      className="fixed z-[100] animate-scale-in"
      style={{ top: popoverStyle.top, left: popoverStyle.left, width: 300 }}
    >
      <GlassFloating className="rounded-2xl border border-border/40 p-4 shadow-[0_12px_40px_rgba(0,0,0,0.15)] space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-border/30"
              style={{ background: selHex }} />
            <span className="text-sm font-medium">{varLabel(selectedVar)}</span>
          </div>
          <button
            onClick={closePopover}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
          >
            <Icon name="close" size={14} className="text-current" />
          </button>
        </div>

        {/* Sliders */}
        <HslSlider label="H" value={selH} min={0} max={360} step={1}
          onChange={(val) => updateVar(selectedVar, val, selS, selL)}
          gradientLeft="#ff0000" gradientRight="#ff00ff" />
        <HslSlider label="S" value={selS} min={0} max={100} step={1}
          onChange={(val) => updateVar(selectedVar, selH, val, selL)}
          gradientLeft="#808080" gradientRight={hslToHex(selH, 100, selL)} />
        <HslSlider label="L" value={selL} min={0} max={100} step={1}
          onChange={(val) => updateVar(selectedVar, selH, selS, val)}
          gradientLeft="#000000" gradientRight={hslToHex(selH, selS, 100)} />

        {/* Hex + color picker */}
        <div className="flex items-center gap-1.5">
          <input type="color" value={selHex}
            onChange={(e) => {
              const hsl = hexToHsl(e.target.value);
              if (hsl) updateVar(selectedVar, hsl[0], hsl[1], hsl[2]);
            }}
            className="w-6 h-6 rounded cursor-pointer border-0 p-0" />
          <input type="text" value={selHex}
            onBlur={(e) => {
              const hsl = hexToHsl(e.target.value);
              if (hsl) updateVar(selectedVar, hsl[0], hsl[1], hsl[2]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const hsl = hexToHsl(e.currentTarget.value);
                if (hsl) updateVar(selectedVar, hsl[0], hsl[1], hsl[2]);
              }
            }}
            className={`${glassControlClass} w-20 px-1.5 py-0.5 border rounded text-[10px] font-mono text-center`} />
        </div>

        {/* Arrow pointing to the swatch */}
        {popoverAnchor && (
          <div
            className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-inherit border-r border-b border-border/40"
            style={{
              top: popoverStyle.top > popoverAnchor.top ? -6.5 : undefined,
              bottom: popoverStyle.top > popoverAnchor.top ? undefined : -6.5,
            }}
          />
        )}
      </GlassFloating>
    </div>
  );

  return (
    <>
      {createPortal(dialog, document.body)}
      {popover && createPortal(popover, document.body)}
    </>
  );
}
