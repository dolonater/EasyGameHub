import { convertFileSrc } from "@tauri-apps/api/core";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Checkbox from "../ui/Checkbox";
import Icon from "../ui/Icon";

interface ScreenshotFile {
  path: string;
  name: string;
  size_bytes: number;
  modified_at: string | null;
}

export default function ScreenshotGrid({
  screenshots,
  onOpen,
  batchMode = false,
  selectedPaths = new Set<string>(),
  onToggleSelect,
  onContextMenu,
}: {
  screenshots: ScreenshotFile[];
  onOpen: (index: number) => void;
  batchMode?: boolean;
  selectedPaths?: Set<string>;
  onToggleSelect?: (path: string) => void;
  onContextMenu?: (e: React.MouseEvent, screenshot: ScreenshotFile) => void;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 animate-fade-in">
      {screenshots.map((shot, index) => (
        <ScreenshotTile
          key={shot.path}
          screenshot={shot}
          selected={selectedPaths.has(shot.path)}
          batchMode={batchMode}
          onToggleSelect={() => onToggleSelect?.(shot.path)}
          onClick={() => onOpen(index)}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}

function ScreenshotTile({
  screenshot,
  onClick,
  batchMode,
  selected,
  onToggleSelect,
  onContextMenu,
}: {
  screenshot: ScreenshotFile;
  onClick: () => void;
  batchMode: boolean;
  selected: boolean;
  onToggleSelect?: () => void;
  onContextMenu?: (e: React.MouseEvent, screenshot: ScreenshotFile) => void;
}) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const src = useMemo(() => convertFileSrc(screenshot.path), [screenshot.path]);

  return (
    <button
      type="button"
      onClick={() => {
        if (batchMode) onToggleSelect?.();
        else onClick();
      }}
      onContextMenu={(e) => onContextMenu?.(e, screenshot)}
      className={`group relative overflow-hidden rounded-2xl border bg-card text-left transition-all duration-200 hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-[0_18px_40px_rgba(0,0,0,0.14)] ${selected ? "ring-2 ring-primary border-primary/40" : ""}`}
      title={screenshot.name}
    >
      {batchMode && (
        <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected} onChange={() => onToggleSelect?.()} color="blue" />
        </div>
      )}

      <div className="aspect-[16/10] bg-secondary/30">
        {!imgError ? (
          <img
            src={src}
            alt={screenshot.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-secondary text-muted-foreground px-4 text-center">
            <Icon name="imageBroken" size={40} className="mb-2 text-foreground dark:text-white/85" />
            <span className="text-xs font-medium line-clamp-2">{screenshot.name}</span>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      {!batchMode && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3 py-2 opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-2 group-hover:translate-y-0">
          <div className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] text-white/90 backdrop-blur-sm">
            <span>{t("screenshots.openImage", "点击查看")}</span>
            <Icon name="arrowRight" size={12} className="text-white/90" />
          </div>
        </div>
      )}
    </button>
  );
}
