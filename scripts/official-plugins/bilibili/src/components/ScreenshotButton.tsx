import React, { useState } from "sdk";
import type { BiliVideoDetail, BiliVideoPage, PluginSdk } from "../types";
import { captureVideoFrame, screenshotFileName } from "../player/frameCapture";

interface ScreenshotButtonProps {
  sdk: PluginSdk | null;
  videoRef: { current: HTMLVideoElement | null };
  detail: BiliVideoDetail;
  selectedPage: BiliVideoPage | null;
  disabled: boolean;
}

export function ScreenshotButton({ sdk, videoRef, detail, selectedPage, disabled }: ScreenshotButtonProps) {
  const [saving, setSaving] = useState(false);

  return (
    <button className="bili-player-icon-button" disabled={disabled || saving} type="button" onClick={saveScreenshot}>
      {saving ? "保存中" : "截图"}
    </button>
  );

  async function saveScreenshot() {
    if (!sdk || !selectedPage || !videoRef.current) return;
    setSaving(true);
    try {
      const video = videoRef.current;
      const dataBase64 = captureVideoFrame(video);
      const fileName = screenshotFileName(detail.bvid, selectedPage.cid, video.currentTime);
      await sdk.bilibili.cache.saveScreenshot({ fileName, dataBase64 });
      sdk.ui.notify("截图已保存");
    } catch (error) {
      sdk.ui.notify(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }
}
