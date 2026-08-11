export function captureVideoFrame(video: HTMLVideoElement) {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) {
    throw new Error("当前视频帧尚未就绪");
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("无法创建截图画布");
  }

  context.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}

export function screenshotFileName(bvid: string, cid: number, seconds: number) {
  const safeBvid = bvid.replace(/[^a-zA-Z0-9]/g, "_") || "BV";
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  return `${safeBvid}_${cid}_${safeSeconds}_${Date.now()}.png`;
}
