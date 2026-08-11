import React, { Button, Icon } from "sdk";
import type { BiliQualityOption } from "../types";
import type { QualityMode } from "../player/dashPlayer";

interface QualityMenuProps {
  qualities: BiliQualityOption[];
  mode: QualityMode;
  playbackMode: "quality" | "compat";
  selectedQualityId: string;
  currentQualityId: string;
  disabled: boolean;
  onAuto(): void;
  onManual(id: string): void;
  onPlaybackModeChange(mode: "quality" | "compat"): void;
}

export function QualityMenu({
  qualities,
  mode,
  playbackMode,
  selectedQualityId,
  currentQualityId,
  disabled,
  onAuto,
  onManual,
  onPlaybackModeChange,
}: QualityMenuProps) {
  return (
    <div className="bili-quality-menu">
      <div className="bili-section-title">
        <strong>清晰度</strong>
        <small>{playbackMode === "quality" ? (mode === "auto" ? "自动" : "手动") : "兼容"}</small>
      </div>
      <div className="bili-comment-sort" role="tablist" aria-label="播放模式">
        <Button
          aria-selected={playbackMode === "quality"}
          className={playbackMode === "quality" ? "bili-chip bili-chip-active" : "bili-chip"}
          variant="ghost"
          size="sm"
          role="tab"
          type="button"
          onClick={() => onPlaybackModeChange("quality")}
        >
          高清
        </Button>
        <Button
          aria-selected={playbackMode === "compat"}
          className={playbackMode === "compat" ? "bili-chip bili-chip-active" : "bili-chip"}
          variant="ghost"
          size="sm"
          role="tab"
          type="button"
          onClick={() => onPlaybackModeChange("compat")}
        >
          兼容
        </Button>
      </div>
      {qualities.length === 0 ? (
        <div className="bili-state bili-state-compact">暂无清晰度信息</div>
      ) : (
        <div className="bili-quality-list">
          <button
            className={`bili-quality-option bili-quality-auto ${mode === "auto" ? "bili-quality-option-active" : ""}`}
            disabled={disabled}
            type="button"
            onClick={onAuto}
          >
            <span className="bili-quality-option-main">
              {mode === "auto" ? <Icon name="check" size={14} /> : null}
              <strong>自动</strong>
            </span>
            <small>{currentLabel(currentQualityId, qualities)}</small>
          </button>
          {qualities.map((quality) => {
            const active = mode === "manual" && selectedQualityId === quality.id;
            return (
              <button
                className={`bili-quality-option ${active ? "bili-quality-option-active" : ""}`}
                disabled={disabled}
                key={quality.id}
                type="button"
                onClick={() => onManual(quality.id)}
              >
                <span className="bili-quality-option-main">
                  {active ? <Icon name="check" size={14} /> : null}
                  <strong>{qualityText(quality)}</strong>
                </span>
                <small>
                  {quality.width && quality.height ? `${quality.width}x${quality.height}` : quality.codecs || "video"}
                </small>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function currentLabel(currentQualityId: string, qualities: BiliQualityOption[]) {
  if (!currentQualityId) return "当前清晰度";
  const quality = qualities.find((option) => option.id === currentQualityId);
  return quality ? qualityText(quality) : "当前清晰度";
}

/** 规范化清晰度文本：360P / 480P / 720P / 1080P / 1080P60 / 4K / 8K（参考网页版）。 */
function qualityText(quality: BiliQualityOption) {
  const label = quality.label || "";
  const pMatch = label.match(/(\d{3,4})P/);
  if (pMatch) return `${pMatch[1]}P`;
  if (label.includes("8K")) return "8K";
  if (label.includes("4K")) return "4K";
  if (label.includes("HDR")) return "HDR";
  return codeLabel(quality.quality) || label || String(quality.quality);
}

function codeLabel(quality: number) {
  switch (quality) {
    case 6:
      return "240P";
    case 16:
      return "360P";
    case 32:
      return "480P";
    case 64:
      return "720P";
    case 74:
      return "720P60";
    case 80:
      return "1080P";
    case 112:
      return "1080P+";
    case 116:
      return "1080P60";
    case 120:
      return "4K";
    case 125:
      return "HDR";
    case 127:
      return "8K";
    default:
      return "";
  }
}
