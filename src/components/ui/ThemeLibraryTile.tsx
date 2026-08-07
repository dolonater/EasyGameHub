import type { Theme } from "../../lib/types";
import { translateThemeName } from "../../lib/themeName";
import GlassCard from "./GlassCard";

interface ThemeLibraryTileProps {
  theme: Theme;
  isActive: boolean;
  isDefault: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onExport: () => void;
  onDelete: () => void;
  onSetGlobalDefault: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export default function ThemeLibraryTile({
  theme,
  isActive,
  isDefault,
  onEdit,
  onCopy,
  onExport,
  onDelete,
  onSetGlobalDefault,
  t,
}: ThemeLibraryTileProps) {
  return (
    <GlassCard
      key={theme.id}
      bordered={false}
      className={`relative border-2 p-2.5 transition-all group ${isActive ? "border-primary/50 bg-primary/5" : "border-transparent hover:border-border hover:bg-card"}`}
    >
      <div className="flex gap-[3px] mb-1.5">
        {(["primary", "accent", "background", "card", "border", "muted"] as const).map((k) => (
          <span
            key={k}
            className="w-3 h-3 rounded-full border border-border/30 flex-shrink-0"
            style={{ background: `hsl(${theme.dark[k]})` }}
          />
        ))}
      </div>
      <div className="text-xs font-medium truncate pr-5">
        {translateThemeName(theme.id, theme.name, t)}
      </div>
      {theme.isPreset && (
        <span className="absolute top-2 right-2 text-[8px] bg-primary/10 text-primary px-1 py-0.5 rounded-full leading-none">
          {t("theme.preset")}
        </span>
      )}
      {isActive && (
        <span className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-primary" title={t("theme.globalDefault")} />
      )}

      <div className="absolute inset-0 rounded-[var(--radius)] bg-card/90 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1 flex-wrap p-1 z-10">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="px-2 py-1 text-[10px] border rounded hover:bg-secondary transition-colors"
        >
          {t("theme.edit")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className="px-2 py-1 text-[10px] border rounded hover:bg-secondary transition-colors"
        >
          {t("theme.copy")}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onExport();
          }}
          className="px-2 py-1 text-[10px] border rounded hover:bg-secondary transition-colors"
        >
          {t("theme.export")}
        </button>
        {!isDefault && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="px-2 py-1 text-[10px] border rounded hover:bg-destructive/10 text-destructive transition-colors"
          >
            {t("theme.delete")}
          </button>
        )}
      </div>

      {!isActive && (
        <button
          onClick={async (e) => {
            e.stopPropagation();
            await onSetGlobalDefault();
          }}
          className="absolute inset-0 rounded-[var(--radius)] z-0"
          title={t("theme.globalDefault")}
        />
      )}
    </GlassCard>
  );
}
