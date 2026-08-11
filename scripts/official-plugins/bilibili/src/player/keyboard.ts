interface KeyboardOptions {
  video: HTMLVideoElement;
  container: HTMLElement;
  onFullscreenToggle(): void;
  onDanmakuToggle(): void;
  onChange(): void;
}

export function attachPlayerKeyboard(options: KeyboardOptions) {
  const onKeyDown = (event: KeyboardEvent) => {
    if (isEditingTarget(event.target)) return;

    switch (event.key) {
      case " ":
      case "Spacebar":
        event.preventDefault();
        if (options.video.paused) playSafely(options.video);
        else options.video.pause();
        options.onChange();
        break;
      case "ArrowLeft":
        event.preventDefault();
        options.video.currentTime = Math.max(0, options.video.currentTime - 5);
        options.onChange();
        break;
      case "ArrowRight":
        event.preventDefault();
        options.video.currentTime = Math.min(duration(options.video), options.video.currentTime + 5);
        options.onChange();
        break;
      case "ArrowUp":
        event.preventDefault();
        options.video.volume = clamp(options.video.volume + 0.05, 0, 1);
        options.video.muted = false;
        options.onChange();
        break;
      case "ArrowDown":
        event.preventDefault();
        options.video.volume = clamp(options.video.volume - 0.05, 0, 1);
        options.onChange();
        break;
      case "m":
      case "M":
        event.preventDefault();
        options.video.muted = !options.video.muted;
        options.onChange();
        break;
      case "f":
      case "F":
        event.preventDefault();
        options.onFullscreenToggle();
        break;
      case "d":
      case "D":
        event.preventDefault();
        options.onDanmakuToggle();
        break;
      case "Escape":
        if (options.container.classList.contains("bili-player-shell-fullscreen")) {
          event.preventDefault();
          options.onFullscreenToggle();
        }
        break;
    }
  };

  window.addEventListener("keydown", onKeyDown);
  return () => {
    window.removeEventListener("keydown", onKeyDown);
  };
}

function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function duration(video: HTMLVideoElement) {
  return Number.isFinite(video.duration) && video.duration > 0 ? video.duration : Number.MAX_SAFE_INTEGER;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function playSafely(video: HTMLVideoElement) {
  void video.play().catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") return;
    throw error;
  });
}
