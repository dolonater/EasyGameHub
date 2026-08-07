import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { formatSize } from "../../lib/types";
import { useTranslation } from "react-i18next";
import Icon from "../ui/Icon";

interface ScreenshotFile {
  path: string;
  name: string;
  size_bytes: number;
  modified_at: string | null;
}

const MIN_ZOOM = 1 / 3;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.12;

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

export default function ScreenshotLightbox({
  open,
  screenshots,
  index,
  onIndexChange,
  onClose,
  onOpenFolder,
  onDelete,
}: {
  open: boolean;
  screenshots: ScreenshotFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onOpenFolder: (path: string) => void;
  onDelete?: (path: string) => void;
}) {
  const { t } = useTranslation();
  const current = screenshots[index];
  const src = useMemo(() => (current ? convertFileSrc(current.path) : null), [current]);
  const hasPrev = index > 0;
  const hasNext = index < screenshots.length - 1;
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setZoom(1);
  }, [open, current?.path]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const direction = e.deltaY < 0 ? 1 : -1;
    setZoom((currentZoom) => clampZoom(currentZoom + direction * ZOOM_STEP));
  }, []);

  useEffect(() => {
    if (!open || !current) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft" && hasPrev) {
        e.preventDefault();
        onIndexChange(index - 1);
        return;
      }
      if (e.key === "ArrowRight" && hasNext) {
        e.preventDefault();
        onIndexChange(index + 1);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, current, hasPrev, hasNext, index, onClose, onIndexChange]);

  if (!open || !current || !src) return null;

  const viewer = (
    <div
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 z-20 w-11 h-11 rounded-full bg-black/45 border border-white/15 text-white/90 hover:bg-black/65 transition-all duration-200 text-lg shadow-lg animate-scale-in hover:scale-105"
        title={t("screenshots.close")}
      >
        ✕
      </button>

      <div className="absolute top-4 left-4 z-20 rounded-full bg-black/45 border border-white/10 px-3 py-1.5 text-xs text-white/75 backdrop-blur-sm animate-scale-in">
        {index + 1} / {screenshots.length}
        <span className="mx-2 text-white/35">|</span>
        {Math.round(zoom * 100)}%
      </div>

      <div
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden px-16 py-8"
        onWheel={handleWheel}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasPrev) onIndexChange(index - 1);
          }}
          disabled={!hasPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-12 h-12 rounded-full bg-black/45 border border-white/15 text-white/90 hover:bg-black/65 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg animate-scale-in hover:scale-105"
          title={t("screenshots.prev")}
        >
          <Icon name="arrowLeft" size={20} className="text-white/90" />
        </button>

        <img
          key={current.path}
          src={src}
          alt={current.name}
          className="max-w-full max-h-full object-contain rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.45)] transition-transform duration-100"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasNext) onIndexChange(index + 1);
          }}
          disabled={!hasNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-12 h-12 rounded-full bg-black/45 border border-white/15 text-white/90 hover:bg-black/65 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg animate-scale-in hover:scale-105"
          title={t("screenshots.next")}
        >
          <Icon name="arrowRight" size={20} className="text-white/90" />
        </button>
      </div>

      <div
        className="border-t border-white/10 bg-black/55 px-5 py-4 flex items-center gap-4 backdrop-blur-md animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex-1">
          <div className="text-white text-sm font-medium truncate">{current.name}</div>
          <div className="text-white/65 text-xs mt-1 flex items-center gap-3 flex-wrap">
            <span>{formatSize(current.size_bytes)}</span>
            <span>{index + 1} / {screenshots.length}</span>
            {current.modified_at && <span>{current.modified_at}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => onOpenFolder(current.path)}
            className="px-3 py-1.5 text-xs rounded-full border border-white/15 text-white/90 hover:bg-white/10 transition-all duration-200 hover:scale-[1.03]"
          >
            {t("screenshots.openFolder")}
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(current.path)}
            disabled={!onDelete}
            className="px-3 py-1.5 text-xs rounded-full border border-red-500/30 text-red-300 hover:bg-red-500/10 transition-all duration-200 hover:scale-[1.03] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t("screenshots.delete")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(viewer, document.body);
}
