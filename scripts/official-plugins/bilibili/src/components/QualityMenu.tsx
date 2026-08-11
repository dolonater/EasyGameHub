import React, { Button } from "sdk";
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
            <strong>自动</strong>
            <small>{currentLabel(currentQualityId, qualities)}</small>
          </button>
          {qualities.map((quality) => (
            <button
              className={`bili-quality-option ${
                mode === "manual" && selectedQualityId === quality.id ? "bili-quality-option-active" : ""
              }`}
              disabled={disabled}
              key={quality.id}
              type="button"
              onClick={() => onManual(quality.id)}
            >
              <strong>{quality.label || quality.quality}</strong>
              <small>
                {quality.width && quality.height ? `${quality.width}x${quality.height}` : quality.codecs || "video"}
              </small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function currentLabel(currentQualityId: string, qualities: BiliQualityOption[]) {
  if (!currentQualityId) return "当前清晰度";
  return qualities.find((quality) => quality.id === currentQualityId)?.label ?? "当前清晰度";
}
