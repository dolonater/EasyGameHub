export const cssText = `
.bili-shell {
  --bili-accent: #fb7299;
  --bili-cyan: #23ade5;
  --bili-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --bili-spring: cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: min(760px, 100%);
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-shell *,
.bili-shell *::before,
.bili-shell *::after {
  box-sizing: border-box;
  letter-spacing: 0;
}
.bili-hidden {
  display: none;
}
.bili-home {
  display: grid;
  gap: 14px;
  max-width: 980px;
  margin: 0 auto;
}
.bili-home-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  gap: 12px;
}
.bili-home-header span,
.bili-login-heading span,
.bili-account-main {
  display: grid;
  gap: 3px;
}
.bili-home-header strong {
  font-size: 28px;
  line-height: 1.15;
}
.bili-home-header small,
.bili-login-heading small,
.bili-account-main small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-home-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 14px;
  align-items: start;
}
.bili-main-column,
.bili-side-column {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.bili-search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
}
.bili-search input {
  min-width: 0;
  min-height: 36px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 70%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
}
.bili-search input::placeholder {
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-login-panel,
.bili-content-panel,
.bili-empty-panel,
.bili-library {
  min-height: 360px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 78%, transparent);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
}
.bili-login-panel {
  display: grid;
  gap: 18px;
  align-content: start;
  padding: 18px;
}
.bili-content-panel,
.bili-library {
  display: grid;
  gap: 14px;
  align-content: start;
  padding: 14px;
}
.bili-library {
  min-height: 172px;
}
.bili-empty-panel {
  display: grid;
  place-items: center;
  text-align: center;
  padding: 24px;
}
.bili-login-heading,
.bili-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}
.bili-login-heading strong,
.bili-account-main strong {
  font-size: 16px;
  line-height: 1.2;
}
.bili-account {
  justify-content: flex-start;
}
.bili-avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  object-fit: cover;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 70%, transparent);
}
.bili-account-main {
  flex: 1;
  min-width: 0;
}
.bili-login-flow {
  display: grid;
  justify-items: center;
  gap: 14px;
  padding: 12px 0 6px;
}
.bili-qr,
.bili-qr-placeholder {
  width: 196px;
  height: 196px;
  border-radius: 8px;
}
.bili-qr {
  display: block;
  background: #fff;
  padding: 8px;
}
.bili-qr-placeholder {
  display: grid;
  place-items: center;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  border: 1px dashed color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 26%, transparent);
}
.bili-login-actions {
  min-height: 34px;
}
.bili-button {
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--bili-accent) 68%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bili-accent) 88%, #111827 12%);
  color: #fff;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.bili-button:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}
.bili-button-ghost {
  border-color: color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 48%, transparent);
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 52%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-link-button {
  display: inline-grid;
  place-items: center;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 48%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 52%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 12px;
  font-size: 13px;
  text-decoration: none;
}
.bili-status {
  margin: 0;
  color: color-mix(in srgb, var(--bili-cyan) 80%, hsl(var(--foreground, 0 0% 98%)));
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}
.bili-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.bili-section-title strong {
  font-size: 16px;
  line-height: 1.2;
}
.bili-section-title small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-video-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(184px, 1fr));
  gap: 12px;
}
.bili-video-card {
  display: grid;
  gap: 9px;
  min-width: 0;
  padding: 8px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 220ms var(--bili-spring), box-shadow 220ms var(--bili-ease);
}
.bili-video-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
}
.bili-cover-wrap {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 38%, transparent);
}
.bili-cover,
.bili-cover-empty {
  width: 100%;
  height: 100%;
}
.bili-cover {
  display: block;
  object-fit: cover;
  transition: transform 160ms ease;
}
.bili-video-card:hover .bili-cover {
  transform: scale(1.025);
}
.bili-cover-empty {
  display: grid;
  place-items: center;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-duration {
  position: absolute;
  right: 6px;
  bottom: 6px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  padding: 2px 6px;
  font-size: 12px;
  line-height: 1.25;
}
.bili-video-body {
  display: grid;
  gap: 5px;
  min-width: 0;
}
.bili-video-body strong {
  display: -webkit-box;
  min-height: 40px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  line-height: 1.45;
}
.bili-video-body small,
.bili-video-meta,
.bili-library-empty span {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-video-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bili-video-progress {
  display: block;
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 34%, transparent);
}
.bili-video-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--bili-accent);
}
.bili-state,
.bili-library-empty {
  display: grid;
  place-items: center;
  min-height: 112px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  text-align: center;
  font-size: 13px;
}
.bili-state-error {
  color: color-mix(in srgb, #ef4444 82%, hsl(var(--foreground, 0 0% 98%)));
}
.bili-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.bili-tab {
  min-height: 32px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 50%, transparent);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.bili-tab-active {
  border-color: color-mix(in srgb, var(--bili-accent) 62%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-library-empty {
  min-height: 86px;
  gap: 5px;
}
.bili-library-empty strong {
  color: hsl(var(--foreground, 0 0% 98%));
  font-size: 13px;
}
.bili-library-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  gap: 10px;
  min-width: 0;
}
.bili-favorite-browser {
  display: grid;
  grid-template-columns: 126px minmax(0, 1fr);
  gap: 10px;
  min-width: 0;
}
.bili-folder-list,
.bili-folder-videos,
.bili-favorite-picker,
.bili-library-actions {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bili-folder-list {
  align-content: start;
  max-height: 380px;
  overflow: auto;
}
.bili-folder-videos {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}
.bili-folder-item {
  display: grid;
  gap: 3px;
  min-width: 0;
  min-height: 38px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 38%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 44%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 7px 9px;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.bili-folder-item span,
.bili-folder-item small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-folder-item small,
.bili-favorite-picker > span {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
}
.bili-folder-item-active {
  border-color: color-mix(in srgb, var(--bili-accent) 70%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 18%, hsl(var(--card, 0 0% 100%)));
}
.bili-panel-copy {
  display: grid;
  gap: 8px;
  max-width: 520px;
}
.bili-panel-copy strong {
  font-size: 24px;
  line-height: 1.2;
}
.bili-panel-copy span {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 13px;
  line-height: 1.6;
}
.bili-watch {
  display: grid;
  gap: 14px;
  max-width: 1180px;
  margin: 0 auto;
}
.bili-watch-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  align-items: start;
}
.bili-watch-main,
.bili-watch-side {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.bili-player-shell,
.bili-video-detail-panel {
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
}
.bili-player-shell {
  position: relative;
  display: grid;
  aspect-ratio: 16 / 9;
  min-height: 260px;
  overflow: hidden;
  background: #05070c;
}
.bili-player-shell-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 10000;
  width: 100vw;
  height: 100vh;
  aspect-ratio: auto;
  border-radius: 0;
}
.bili-video-element,
.bili-danmaku-layer,
.bili-player-overlay {
  grid-area: 1 / 1;
}
.bili-video-element {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #05070c;
  object-fit: contain;
}
.bili-danmaku-layer {
  pointer-events: none;
  position: absolute;
  inset: 0 0 56px;
  z-index: 1;
  overflow: hidden;
}
.bili-danmaku-item {
  position: absolute;
  top: var(--bili-danmaku-top);
  left: 100%;
  max-width: 72%;
  white-space: nowrap;
  font-weight: 700;
  line-height: 1.15;
  text-shadow:
    1px 1px 2px rgba(0, 0, 0, 0.78),
    -1px -1px 2px rgba(0, 0, 0, 0.58);
  will-change: transform;
  pointer-events: auto;
  cursor: pointer;
  animation: bili-danmaku-roll var(--bili-danmaku-duration) linear forwards;
}
@keyframes bili-danmaku-roll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(calc(-100vw - 100%));
  }
}
/* mode 2/3 固定弹幕：独立于滚动轨道，垂直定位用 inline top/bottom，淡入淡出 */
.bili-danmaku-item.bili-danmaku-fixed {
  left: 0;
  animation: bili-danmaku-fade var(--bili-danmaku-duration) linear forwards;
}
.bili-danmaku-fixed-top {
  top: var(--bili-danmaku-top, 6px);
}
.bili-danmaku-fixed-bottom {
  bottom: var(--bili-danmaku-bottom, 6px);
}
@keyframes bili-danmaku-fade {
  0% {
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  85% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
/* 自己发送的弹幕：5 分钟窗口内高亮描边 */
.bili-danmaku-item.bili-danmaku-self {
  box-shadow: 0 0 0 2px rgba(0, 174, 255, 0.9);
  border-radius: 3px;
}
/* 弹幕操作菜单（点赞/举报/撤回）：absolute 相对弹幕层定位，越界自动翻转 */
.bili-danmaku-menu {
  position: absolute;
  z-index: 100;
  display: grid;
  gap: 3px;
  min-width: 150px;
  pointer-events: auto;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 92%, #05070c 8%);
  padding: 6px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
}
.bili-danmaku-menu-title {
  padding: 4px 10px 2px;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-danmaku-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: 0;
  border-radius: 6px;
  background: transparent;
  padding: 7px 10px;
  font-size: 13px;
  color: hsl(var(--foreground, 0 0% 100%));
  cursor: pointer;
  text-align: left;
}
.bili-danmaku-menu-item:hover {
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 55%, transparent);
}
/* 视频暂停时弹幕动画同步暂停 */
.bili-danmaku-layer.bili-danmaku-paused .bili-danmaku-item {
  animation-play-state: paused;
}
.bili-player-overlay {
  z-index: 2;
  display: grid;
  place-items: center;
  gap: 8px;
  align-content: center;
  padding: 24px;
  background: rgba(5, 7, 12, 0.72);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  text-align: center;
}
.bili-player-overlay strong {
  color: hsl(var(--foreground, 0 0% 98%));
  font-size: 18px;
}
.bili-player-overlay span {
  max-width: 620px;
  overflow-wrap: anywhere;
  font-size: 13px;
  line-height: 1.55;
}
.bili-player-overlay-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}
.bili-player-controls {
  position: absolute;
  z-index: 3;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-rows: auto auto;
  gap: 5px;
  padding: 6px 12px 10px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.78), rgba(0, 0, 0, 0.25));
  transition: opacity 0.22s ease;
}
.bili-player-controls-hidden {
  opacity: 0;
  pointer-events: none;
}
.bili-player-playbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 10px;
  align-items: center;
}
.bili-player-controls-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.bili-ctrl-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #fff;
  cursor: pointer;
  transition: background 0.15s ease, opacity 0.15s ease, transform 160ms var(--bili-spring);
}
.bili-ctrl-btn:hover {
  background: rgba(0, 0, 0, 0.5);
}
.bili-ctrl-btn-label {
  width: auto;
  border-radius: 999px;
  padding: 0 12px;
}
.bili-ctrl-btn small {
  font-size: 11px;
  line-height: 1;
  opacity: 0.92;
}
.bili-ctrl-btn:disabled,
.bili-player-rate:disabled,
.bili-player-seek:disabled,
.bili-player-volume:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.bili-player-time {
  min-width: 42px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.bili-player-seek {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--bili-accent) var(--progress, 0%),
    rgba(255, 255, 255, 0.26) var(--progress, 0%)
  );
  cursor: pointer;
}
.bili-player-seek::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bili-accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.bili-player-seek::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--bili-accent);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
.bili-player-volume {
  -webkit-appearance: none;
  appearance: none;
  min-width: 74px;
  width: 74px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.26);
  cursor: pointer;
}
.bili-player-volume::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
}
.bili-player-volume::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
}
.bili-player-rate-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #fff;
}
.bili-player-rate {
  width: auto;
  min-width: 52px;
  height: 34px;
  border: 0;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.5);
  color: #fff;
  font: inherit;
  font-size: 12px;
  padding: 0 8px;
  cursor: pointer;
}
.bili-video-detail-panel {
  display: grid;
  gap: 12px;
  padding: 16px;
}
.bili-danmaku-input {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 8px;
  align-items: center;
  min-height: 44px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 72%, transparent);
  padding: 8px;
}
.bili-danmaku-input input {
  min-width: 0;
  min-height: 32px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
}
.bili-danmaku-input input:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}
.bili-danmaku-count {
  min-width: 48px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
  text-align: center;
}
.bili-video-heading {
  display: grid;
  gap: 5px;
}
.bili-video-heading strong {
  font-size: 22px;
  line-height: 1.25;
}
.bili-video-heading small,
.bili-video-detail-panel p {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 13px;
  line-height: 1.6;
}
.bili-video-detail-panel p {
  margin: 0;
  white-space: pre-wrap;
}
.bili-interaction-wrap {
  position: relative;
  display: grid;
  gap: 10px;
  min-width: 0;
}
.bili-interaction-bar {
  display: flex;
  gap: 8px;
  min-width: 0;
  overflow-x: auto;
  padding: 2px 0 4px;
  scrollbar-width: thin;
}
.bili-popover-anchor {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
}
.bili-interaction-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: max-content;
  min-height: 38px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 40%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 54%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 12px;
}
.bili-interaction-button small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
}
.bili-interaction-button-active {
  border-color: color-mix(in srgb, var(--bili-accent) 68%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 18%, hsl(var(--card, 0 0% 100%)));
}
.bili-interaction-button-active svg {
  color: var(--bili-accent);
}
.bili-interaction-button-active small {
  color: color-mix(in srgb, var(--bili-accent) 82%, #fff);
}
.bili-menu-popover {
  position: absolute;
  z-index: 50;
  display: grid;
  gap: 3px;
  min-width: 200px;
  max-width: min(300px, calc(100vw - 24px));
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 92%, #05070c 8%);
  padding: 6px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
}
.bili-menu-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 28px;
  padding: 2px 8px 5px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-menu-heading strong {
  color: hsl(var(--foreground, 0 0% 98%));
  font-size: 13px;
}
.bili-menu-close {
  border: 0;
  background: transparent;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.bili-menu-close:hover {
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 10px;
  text-align: left;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.bili-menu-item:hover {
  background: color-mix(in srgb, var(--bili-accent) 18%, transparent);
}
.bili-menu-item-active {
  background: color-mix(in srgb, var(--bili-accent) 16%, transparent);
  color: var(--bili-accent);
}
.bili-menu-item small {
  margin-left: auto;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
}
.bili-menu-empty {
  padding: 6px 10px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-folder-scroll {
  display: grid;
  gap: 3px;
  max-height: 280px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.bili-menu-footer {
  padding-top: 2px;
}
.bili-segment-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.bili-segment {
  min-height: 34px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 40%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 50%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  font: inherit;
}
.bili-segment-active {
  border-color: color-mix(in srgb, var(--bili-accent) 70%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 20%, hsl(var(--card, 0 0% 100%)));
}
.bili-owner-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 38%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 58%, transparent);
  padding: 8px;
}
.bili-owner-main {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  padding: 0;
  text-align: left;
}
.bili-owner-main:disabled {
  cursor: default;
}
.bili-owner-avatar {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 8px;
  object-fit: cover;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 52%, transparent);
}
.bili-owner-main span {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.bili-owner-main strong,
.bili-owner-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-owner-main strong {
  font-size: 14px;
}
.bili-owner-main small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-page-list,
.bili-quality-list,
.bili-quality-menu {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bili-page-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 38px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 48%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 10px;
  text-align: left;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.bili-page-item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-page-item small,
.bili-quality-option small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
}
.bili-page-item-active {
  border-color: color-mix(in srgb, var(--bili-accent) 70%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 20%, hsl(var(--card, 0 0% 100%)));
}
.bili-quality-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 38%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 44%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 10px;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.bili-quality-option-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.bili-quality-option-main strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-quality-option-main svg {
  color: var(--bili-accent);
}
.bili-quality-option:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}
.bili-quality-auto {
  border-color: color-mix(in srgb, var(--bili-cyan) 58%, transparent);
}
.bili-quality-option-active {
  border-color: color-mix(in srgb, var(--bili-accent) 76%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 20%, hsl(var(--card, 0 0% 100%)));
}
.bili-state-compact {
  min-height: 48px;
}
.bili-action-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.bili-library-actions {
  padding-top: 2px;
}
.bili-favorite-picker {
  max-height: 180px;
  overflow: auto;
}
.bili-danmaku-settings,
.bili-slider-line {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bili-toggle-line,
.bili-slider-line span {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-toggle-line {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bili-toggle-line input,
.bili-slider-line input {
  accent-color: var(--bili-accent);
}
.bili-slider-line input {
  width: 100%;
}
.bili-comments {
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 70%, transparent);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.16);
  display: grid;
  gap: 14px;
  margin-top: 16px;
  padding: 16px;
  min-width: 0;
}
.bili-comments-header,
.bili-comment-editor-actions,
.bili-comment-actions,
.bili-comment-report,
.bili-comment-footer {
  align-items: center;
  display: flex;
  gap: 10px;
}
.bili-comments-header {
  justify-content: space-between;
  min-width: 0;
}
.bili-comment-sort {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.bili-chip {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font-size: 12px;
  padding: 6px 10px;
}
.bili-chip-active {
  border-color: rgba(0, 174, 236, 0.5);
  background: rgba(0, 174, 236, 0.18);
  color: #e6f8ff;
}
.bili-comment-editor,
.bili-comment-reply-editor {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bili-comment-editor {
  padding: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px 12px 16px 16px;
  background: rgba(255, 255, 255, 0.05);
}
.bili-comment-editor textarea {
  border: 0;
  background: transparent;
  color: hsl(var(--foreground, 0 0% 98%));
  min-height: 72px;
  padding: 6px 8px;
  resize: vertical;
  outline: none;
}
.bili-comment-reply-editor input,
.bili-comment-report input,
.bili-comment-report select {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: hsl(var(--foreground, 0 0% 98%));
  min-width: 0;
  outline: none;
}
.bili-comment-reply-editor {
  grid-template-columns: minmax(0, 1fr) auto;
}
.bili-comment-reply-editor input,
.bili-comment-report input,
.bili-comment-report select {
  height: 36px;
  padding: 0 10px;
}
.bili-comment-editor-actions {
  justify-content: space-between;
}
.bili-comment-editor-actions .bili-button {
  border: 0;
  border-radius: 999px;
  background: var(--bili-accent);
  color: #fff;
  padding: 0 20px;
  min-height: 32px;
  font-size: 13px;
}
.bili-comment-editor-actions .bili-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.bili-comment-editor-actions span,
.bili-comment-footer,
.bili-comment-user-info p,
.bili-comment-actions button,
.bili-comment-reply button {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-comment-list,
.bili-comment-top-list {
  display: grid;
  gap: 12px;
}
.bili-comment-card {
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 35%, transparent);
  border-radius: 0;
  background: transparent;
  display: grid;
  gap: 8px;
  padding: 12px 4px;
  min-width: 0;
}
.bili-comment-card:last-child {
  border-bottom: 0;
}
.bili-comment-card-top {
  background: color-mix(in srgb, var(--bili-cyan) 8%, transparent);
}
.bili-thumb {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 22px;
  padding: 0 7px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  transition: color 0.2s var(--bili-ease), border-color 0.2s var(--bili-ease), background 0.2s var(--bili-ease), transform 180ms var(--bili-spring);
}
.bili-thumb-icon {
  width: 14px;
  height: 14px;
  transition: transform 0.2s ease;
}
.bili-thumb:hover {
  color: var(--bili-accent);
}
.bili-thumb:hover .bili-thumb-icon {
  transform: scale(1.3);
}
.bili-thumb-active {
  color: var(--bili-accent);
  border-color: color-mix(in srgb, var(--bili-accent) 55%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 12%, transparent);
}
.bili-thumb:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.bili-comment-main {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bili-comment-user {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  min-width: 0;
}
.bili-comment-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  object-fit: cover;
}
.bili-comment-user-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.bili-comment-user-info span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 700;
  font-size: 13px;
}
.bili-comment-user-info p {
  margin: 0;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
}
.bili-comment-content {
  margin: 0;
  color: hsl(var(--foreground, 0 0% 98%));
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.bili-comment-pictures {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.bili-comment-pictures img {
  border-radius: 8px;
  height: 96px;
  object-fit: cover;
  width: 96px;
}
.bili-comment-actions {
  flex-wrap: wrap;
}
.bili-comment-actions button,
.bili-comment-reply button {
  background: transparent;
  border: 0;
  cursor: pointer;
  padding: 0;
}
.bili-comment-actions button:disabled,
.bili-comment-reply button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
.bili-comment-replies {
  border-left: 2px solid rgba(255, 255, 255, 0.09);
  display: grid;
  gap: 8px;
  padding-left: 12px;
}
.bili-comment-reply {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.bili-comment-reply-wrap {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bili-comment-reply span {
  color: hsl(var(--foreground, 0 0% 98%));
  flex: 1 1 180px;
  overflow-wrap: anywhere;
}
.bili-comment-report {
  flex-wrap: wrap;
}
.bili-comment-report input {
  flex: 1 1 180px;
}
.bili-comment-footer {
  justify-content: center;
}
.bili-settings {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.bili-setting-field {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  display: grid;
  gap: 8px;
  font-size: 12px;
}
.bili-setting-field select {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: hsl(var(--foreground, 0 0% 98%));
  height: 36px;
  padding: 0 10px;
}
.bili-top-nav {
  display: grid;
  grid-template-columns: minmax(180px, auto) minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  min-height: 58px;
  padding: 10px 16px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 42%, transparent);
  backdrop-filter: blur(14px);
}
.bili-brand,
.bili-profile-button,
.bili-nav-tab,
.bili-feed-tab,
.bili-watch-tab {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}
.bili-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 0;
  text-align: left;
  cursor: pointer;
}
.bili-brand-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--bili-accent) 88%, #111827 12%);
  color: #fff;
  font-weight: 800;
}
.bili-brand span:last-child {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.bili-brand strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  line-height: 1.15;
}
.bili-brand small {
  overflow: hidden;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-nav-tabs {
  display: inline-flex;
  justify-self: center;
  gap: 6px;
  min-width: 0;
  padding: 4px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 48%, transparent);
}
.bili-nav-tab {
  min-width: 64px;
  min-height: 32px;
  border-radius: 7px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
}
.bili-nav-tab-active {
  background: color-mix(in srgb, var(--bili-accent) 18%, hsl(var(--card, 0 0% 100%)));
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-top-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
}
.bili-profile-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 190px;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 52%, transparent);
  padding: 0 10px 0 6px;
  cursor: pointer;
}
.bili-profile-button span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.bili-profile-avatar {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  border-radius: 6px;
  object-fit: cover;
}
.bili-profile-avatar-empty {
  background: color-mix(in srgb, var(--bili-cyan) 30%, hsl(var(--card, 0 0% 100%)));
  color: #fff;
  font-size: 12px;
}
.bili-home {
  max-width: 1220px;
}
.bili-search {
  max-width: 760px;
}
.bili-feed-panel {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.bili-feed-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 38px;
}
.bili-feed-heading > span,
.bili-feed-context {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-feed-tabs {
  display: inline-flex;
  gap: 8px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.bili-feed-tabs::-webkit-scrollbar {
  display: none;
}
.bili-hot-subtabs {
  display: inline-flex;
  gap: 6px;
  margin: 2px 0 12px;
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
.bili-hot-subtabs::-webkit-scrollbar {
  display: none;
}
.bili-hot-subtab {
  min-width: 64px;
  min-height: 28px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 30%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 40%, transparent);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font-size: 12px;
}
.bili-hot-subtab-active {
  border-color: color-mix(in srgb, var(--bili-accent) 60%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 16%, hsl(var(--card, 0 0% 100%)));
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-rank-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.bili-rank-rids {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.bili-rank-rid {
  min-height: 26px;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 30%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 40%, transparent);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font-size: 12px;
}
.bili-rank-rid-active {
  border-color: color-mix(in srgb, var(--bili-accent) 60%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 16%, hsl(var(--card, 0 0% 100%)));
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-precious-head {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 55%, transparent);
}
.bili-precious-title {
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-precious-explain {
  margin-top: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-search-box {
  position: relative;
  flex: 1;
  min-width: 0;
}
.bili-suggest-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 30;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 92%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  max-height: 320px;
  overflow-y: auto;
}
.bili-suggest-item {
  display: block;
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  font-size: 13px;
}
.bili-suggest-item:hover {
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 55%, transparent);
}
.bili-search-empty {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.bili-search-empty-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bili-search-empty-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-search-clear {
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font-size: 12px;
}
.bili-search-words {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.bili-search-word {
  padding: 5px 12px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 30%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 40%, transparent);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font-size: 12px;
}
.bili-search-word:hover {
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-hotword-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 4px 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.bili-hotword-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 8px;
  text-align: left;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  font-size: 13px;
}
.bili-hotword-item:hover {
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 55%, transparent);
}
.bili-hotword-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 45%, transparent);
}
.bili-hotword-rank-top {
  color: #fff;
  background: var(--bili-accent);
}
.bili-fav-manage-entry {
  align-self: flex-start;
  color: hsl(var(--muted-foreground, 240 5% 64%)) !important;
  font-size: 12px;
}
.bili-fav-manage {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
.bili-fav-manage-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bili-fav-manage-action {
  padding: 5px 12px;
  border: 1px solid color-mix(in srgb, var(--bili-accent) 50%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--bili-accent) 14%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  font-size: 12px;
}
.bili-fav-manage-selected {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-folder-manage-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
.bili-folder-item-grow {
  flex: 1;
  min-width: 0;
}
.bili-fav-manage-link {
  padding: 4px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}
.bili-fav-manage-link:hover {
  color: hsl(var(--foreground, 0 0% 98%));
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 45%, transparent);
}
.bili-fav-manage-danger {
  color: #f87171 !important;
}
.bili-fav-manage-card {
  position: relative;
  cursor: pointer;
}
.bili-fav-manage-card-checked .bili-video-card {
  outline: 2px solid var(--bili-accent);
  outline-offset: 2px;
}
.bili-fav-manage-check {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: inline-flex;
  padding: 2px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  cursor: pointer;
}
.bili-fav-manage-bulk {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 40%, transparent);
}
.bili-confirm-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}
.bili-confirm-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(420px, calc(100vw - 48px));
  padding: 16px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 40%, transparent);
  border-radius: 12px;
  background: hsl(var(--card, 0 0% 100%));
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
}
.bili-confirm-title {
  font-size: 15px;
  font-weight: 600;
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-confirm-copy {
  font-size: 13px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  line-height: 1.5;
}
.bili-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}
.bili-confirm-btn {
  padding: 6px 14px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 60%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  font-size: 13px;
}
.bili-confirm-btn-danger {
  border-color: color-mix(in srgb, #ef4444 60%, transparent);
  background: color-mix(in srgb, #ef4444 22%, transparent);
  color: #fca5a5;
}
.bili-confirm-btn-primary {
  border-color: color-mix(in srgb, var(--bili-accent) 60%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 22%, transparent);
  color: #fff;
}
.bili-move-targets {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 240px;
  overflow-y: auto;
}
.bili-move-target {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  text-align: left;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 30%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 30%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  font-size: 13px;
}
.bili-move-target small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
}
.bili-space {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bili-space-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 12px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 55%, transparent);
}
.bili-space-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 60%, transparent);
}
.bili-space-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.bili-space-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 600;
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-space-level {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bili-accent) 20%, transparent);
  color: var(--bili-accent);
}
.bili-space-live {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, #ef4444 22%, transparent);
  color: #f87171;
}
.bili-space-sign {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-space-stats {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-space-section-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-space-load-more {
  align-self: center;
  padding: 7px 18px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 44%, transparent);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
  font-size: 13px;
}
.bili-space-load-more:hover {
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-pgc-feed {
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.bili-pgc-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bili-pgc-section-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-pgc-track {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 6px;
  scrollbar-width: thin;
}
.bili-pgc-track-wrap {
  flex-wrap: wrap;
  overflow-x: visible;
}
.bili-pgc-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 168px;
  flex: 0 0 auto;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  text-align: left;
}
.bili-pgc-cover {
  width: 168px;
  height: 224px;
  object-fit: cover;
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 40%, transparent);
}
.bili-pgc-card strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bili-pgc-card small {
  font-size: 11px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-pgc-score {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 1px 6px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
}
.bili-rank-tabs {
  display: inline-flex;
  gap: 6px;
}
.bili-season-page {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bili-season-header {
  display: flex;
  gap: 16px;
}
.bili-season-cover {
  width: 140px;
  height: 190px;
  flex: 0 0 auto;
  object-fit: cover;
  border-radius: 12px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 40%, transparent);
}
.bili-season-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}
.bili-season-title {
  font-size: 19px;
  font-weight: 700;
  color: hsl(var(--foreground, 0 0% 98%));
  line-height: 1.4;
}
.bili-season-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-season-evaluate {
  font-size: 13px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bili-season-section-title {
  font-size: 14px;
  font-weight: 600;
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-season-episodes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px;
}
.bili-season-episode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 30%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 45%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  text-align: left;
}
.bili-season-episode:hover {
  border-color: color-mix(in srgb, var(--bili-accent) 50%, transparent);
}
.bili-season-episode-title {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-season-episode-duration {
  flex: 0 0 auto;
  font-size: 11px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-season-followbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 240 5% 64%)) 45%, transparent);
  font-size: 12px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-season-followbar-score {
  color: hsl(var(--foreground, 0 0% 98%));
  font-weight: 600;
}
.bili-season-followbar-new {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-season-follow-btn {
  padding: 5px 14px;
  border: 1px solid color-mix(in srgb, var(--bili-accent) 60%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--bili-accent) 20%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  font-size: 12px;
}
.bili-season-follow-btn:disabled {
  opacity: 0.55;
  cursor: default;
}
.bili-bangumi-follow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.bili-bangumi-follow-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: hsl(var(--foreground, 0 0% 98%));
  cursor: pointer;
  text-align: left;
}
.bili-bangumi-follow-card strong {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bili-bangumi-follow-card small {
  font-size: 11px;
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-feed-tab {
  min-width: 72px;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 44%, transparent);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
}
.bili-feed-tab-active {
  border-color: color-mix(in srgb, var(--bili-accent) 66%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 18%, hsl(var(--card, 0 0% 100%)));
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-video-grid {
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 16px 14px;
}
.bili-mine {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
  align-items: start;
  max-width: 1220px;
  margin: 0 auto;
}
.bili-account-card {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  min-width: 0;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 78%, transparent);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  padding: 16px;
}
.bili-account-card-main {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.bili-account-card-avatar {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border-radius: 50%;
  object-fit: cover;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 70%, transparent);
}
.bili-account-card-id {
  display: grid;
  gap: 3px;
  min-width: 0;
}
.bili-account-card-id strong {
  overflow: hidden;
  max-width: 260px;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 16px;
  line-height: 1.2;
}
.bili-account-card-id small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-account-card-stats {
  display: flex;
  align-items: center;
  gap: 28px;
  margin-left: auto;
}
.bili-account-card-stat {
  display: grid;
  gap: 2px;
  text-align: center;
}
.bili-account-card-stat strong {
  font-size: 18px;
  line-height: 1.1;
}
.bili-account-card-stat small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 11px;
}
.bili-account-card > .bili-button {
  flex: 0 0 auto;
}
.bili-mine .bili-login-panel,
.bili-mine .bili-library {
  min-height: 0;
}
.bili-mine .bili-library {
  align-self: stretch;
}
.bili-watch {
  max-width: 1220px;
}
.bili-watch-grid {
  grid-template-columns: minmax(0, 1fr) minmax(320px, 340px);
}
.bili-watch-side {
  position: sticky;
  top: 12px;
  gap: 10px;
  max-height: calc(100vh - 110px);
  overflow: auto;
  overscroll-behavior: contain;
}
.bili-watch-side-toggle {
  display: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 48%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
  padding: 0 12px;
  text-align: left;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.bili-watch-side-toggle small {
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font-size: 12px;
}
.bili-watch-side-content {
  display: grid;
  gap: 10px;
  min-width: 0;
}
.bili-related-list {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.bili-sidebar-section {
  display: grid;
  gap: 14px;
  align-content: start;
  min-width: 0;
  padding: 14px;
}
/* 分P 区块背景卡片（只给含分P列表的 section；用 --muted，--card==背景色不可见） */
.bili-sidebar-section:has(.bili-page-list) {
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}
.bili-comment-card,
.bili-comment-editor textarea,
.bili-comment-reply-editor input,
.bili-comment-report input,
.bili-comment-report select,
.bili-setting-field select {
  border-radius: 8px;
}

/* ── 动画体系（参考网易云插件动画：弹性缓动 + 错峰进入 + 微交互，遵守 prefers-reduced-motion） ── */
@keyframes bili-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes bili-slide-down {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bili-view-in {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bili-card-in {
  from { opacity: 0; transform: translateY(12px) scale(0.99); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes bili-list-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes bili-popover-in {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 页面进入：.bili-shell / .bili-watch 只用透明度，避免给全屏播放器（position: fixed）制造 containing block */
.bili-shell {
  animation: bili-fade-in 320ms var(--bili-spring);
}
.bili-top-nav {
  animation: bili-slide-down 340ms var(--bili-spring) 40ms backwards;
}
.bili-home,
.bili-mine {
  animation: bili-view-in 360ms var(--bili-spring) both;
}
.bili-watch {
  animation: bili-fade-in 320ms var(--bili-spring);
}

/* 播放页组件级联进入（主区 播放器→弹幕输入→互动条→详情→评论 依次错峰；侧栏整体上浮 + 行内错峰） */
.bili-watch-grid {
  animation: bili-fade-in 240ms var(--bili-spring);
}
.bili-player-shell {
  animation: bili-view-in 380ms var(--bili-spring) backwards;
}
.bili-player-overlay {
  animation: bili-fade-in 240ms var(--bili-spring);
}
.bili-danmaku-input {
  animation: bili-list-in 300ms var(--bili-spring) 50ms backwards;
}
.bili-interaction-wrap {
  animation: bili-list-in 300ms var(--bili-spring) 80ms backwards;
}
.bili-video-detail-panel {
  animation: bili-list-in 300ms var(--bili-spring) 120ms backwards;
}
.bili-comments {
  animation: bili-list-in 320ms var(--bili-spring) 170ms backwards;
}
.bili-watch-side {
  animation: bili-view-in 360ms var(--bili-spring) 60ms backwards;
}
.bili-watch-side .bili-owner-row {
  animation: bili-list-in 280ms var(--bili-spring) 40ms backwards;
}
.bili-watch-side .bili-sidebar-section {
  animation: bili-list-in 280ms var(--bili-spring) backwards;
}
.bili-watch-side .bili-sidebar-section:nth-of-type(2) {
  animation-delay: 90ms;
}

/* 视频卡片错峰进入（首页网格逐卡延迟，相关推荐/我的页库走基础淡入） */
.bili-video-card {
  animation: bili-card-in 360ms var(--bili-spring) backwards;
}
.bili-video-grid .bili-video-card:nth-child(1) { animation-delay: 20ms; }
.bili-video-grid .bili-video-card:nth-child(2) { animation-delay: 40ms; }
.bili-video-grid .bili-video-card:nth-child(3) { animation-delay: 60ms; }
.bili-video-grid .bili-video-card:nth-child(4) { animation-delay: 80ms; }
.bili-video-grid .bili-video-card:nth-child(5) { animation-delay: 100ms; }
.bili-video-grid .bili-video-card:nth-child(6) { animation-delay: 120ms; }
.bili-video-grid .bili-video-card:nth-child(n + 7) { animation-delay: 140ms; }

/* 评论卡片 / 弹层 / 状态提示进入 */
.bili-comment-card {
  animation: bili-list-in 300ms var(--bili-spring) backwards;
}
.bili-menu-popover {
  animation: bili-popover-in 150ms var(--bili-spring);
}
.bili-state {
  animation: bili-list-in 260ms var(--bili-ease);
}

/* 顶部 Tab / 按钮微交互 */
.bili-nav-tab,
.bili-feed-tab,
.bili-tab,
.bili-profile-button {
  transition: transform 160ms var(--bili-spring), background 180ms var(--bili-ease), color 160ms var(--bili-ease), border-color 180ms var(--bili-ease);
}
.bili-nav-tab:hover,
.bili-feed-tab:hover,
.bili-tab:hover,
.bili-profile-button:hover {
  transform: translateY(-1px);
}
.bili-menu-item {
  transition: background 160ms var(--bili-ease), transform 160ms var(--bili-spring);
}
.bili-menu-item:active,
.bili-thumb:active,
.bili-ctrl-btn:active {
  transform: scale(0.9);
}

@media (prefers-reduced-motion: reduce) {
  .bili-shell,
  .bili-top-nav,
  .bili-home,
  .bili-mine,
  .bili-watch,
  .bili-watch-grid,
  .bili-player-shell,
  .bili-player-overlay,
  .bili-danmaku-input,
  .bili-interaction-wrap,
  .bili-video-detail-panel,
  .bili-comments,
  .bili-watch-side,
  .bili-watch-side .bili-owner-row,
  .bili-watch-side .bili-sidebar-section,
  .bili-video-card,
  .bili-comment-card,
  .bili-menu-popover,
  .bili-state {
    animation: none !important;
  }
  .bili-video-card,
  .bili-nav-tab,
  .bili-feed-tab,
  .bili-tab,
  .bili-profile-button,
  .bili-thumb,
  .bili-ctrl-btn,
  .bili-menu-item {
    transition: none !important;
  }
}

@media (max-width: 820px) {
  .bili-shell {
    padding: 12px;
  }
  .bili-top-nav {
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 10px;
    margin-bottom: 12px;
  }
  .bili-nav-tabs {
    justify-self: stretch;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .bili-top-actions {
    justify-content: stretch;
  }
  .bili-top-actions .bili-button,
  .bili-top-actions .bili-link-button,
  .bili-profile-button {
    width: auto;
    flex: 1 1 0;
  }
  .bili-profile-button {
    justify-content: center;
  }
  .bili-home-grid {
    grid-template-columns: 1fr;
  }
  .bili-mine {
    grid-template-columns: 1fr;
  }
  .bili-favorite-browser {
    grid-template-columns: 1fr;
  }
  .bili-folder-list {
    max-height: none;
  }
  .bili-search {
    grid-template-columns: 1fr;
  }
  .bili-login-heading,
  .bili-account {
    align-items: stretch;
    flex-direction: column;
  }
  .bili-button {
    width: 100%;
  }
  .bili-top-actions .bili-button,
  .bili-top-actions .bili-link-button,
  .bili-top-actions .bili-profile-button {
    width: auto;
  }
  .bili-watch-grid {
    grid-template-columns: 1fr;
  }
  .bili-watch-side {
    position: static;
    max-height: none;
    overflow: visible;
  }
  .bili-watch-side-toggle {
    display: flex;
  }
  .bili-watch-side-content {
    display: none;
  }
  .bili-watch-side-open .bili-watch-side-content {
    display: grid;
  }
  .bili-player-shell {
    min-height: 180px;
  }
  .bili-player-playbar .bili-player-time:last-child {
    display: none;
  }
  .bili-player-controls-row .bili-player-volume,
  .bili-player-controls-row .bili-player-rate-wrap {
    display: none;
  }
  .bili-danmaku-input {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .bili-owner-row {
    align-items: stretch;
    flex-direction: column;
  }
  .bili-owner-row .bili-button {
    width: 100%;
  }
  .bili-danmaku-count {
    display: none;
  }
  .bili-danmaku-item {
    max-width: 86%;
  }
  .bili-comments-header,
  .bili-comment-editor-actions,
  .bili-comment-report {
    align-items: stretch;
    flex-direction: column;
  }
  .bili-comment-card {
    grid-template-columns: 34px minmax(0, 1fr);
  }
  .bili-comment-avatar {
    height: 34px;
    width: 34px;
  }
  .bili-comment-reply-editor {
    grid-template-columns: 1fr;
  }
}
.bili-placeholder-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 50vh;
  color: hsl(var(--muted-foreground));
}
.bili-placeholder-label {
  font-size: 18px;
  font-weight: 600;
  color: hsl(var(--foreground));
}
.bili-placeholder-hint {
  font-size: 13px;
}
/* ===== 动态页（P4） ===== */
.bili-dynamic-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 24px;
}
.bili-dynamic-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 55%, transparent);
  padding: 12px 14px;
  cursor: pointer;
  transition: transform 160ms var(--bili-ease), box-shadow 160ms var(--bili-ease);
}
.bili-dynamic-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}
.bili-dynamic-head {
  display: flex;
  align-items: center;
  gap: 10px;
}
.bili-dynamic-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 80%, transparent);
}
.bili-dynamic-avatar-sm {
  width: 28px;
  height: 28px;
}
.bili-dynamic-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.bili-dynamic-meta strong {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-dynamic-meta small {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-dynamic-top-badge {
  margin-left: auto;
  font-size: 11px;
  color: hsl(var(--primary, 240 100% 60%));
  border: 1px solid hsl(var(--primary, 240 100% 60%));
  border-radius: 4px;
  padding: 1px 6px;
}
.bili-dynamic-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
  word-break: break-word;
}
.bili-dynamic-video {
  display: flex;
  gap: 10px;
  align-items: center;
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 60%, transparent);
  padding: 8px;
}
.bili-dynamic-video-cover {
  width: 140px;
  height: 80px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: #05070c;
}
.bili-dynamic-video-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.bili-dynamic-video-info strong {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.bili-dynamic-video-info small {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-dynamic-images {
  display: grid;
  gap: 6px;
}
.bili-dynamic-images-1 {
  grid-template-columns: 1fr;
}
.bili-dynamic-images-2 {
  grid-template-columns: 1fr 1fr;
}
.bili-dynamic-images-3 {
  grid-template-columns: repeat(3, 1fr);
}
.bili-dynamic-image {
  width: 100%;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  object-fit: cover;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 60%, transparent);
}
.bili-dynamic-live {
  display: flex;
  gap: 10px;
  align-items: center;
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 60%, transparent);
  padding: 8px;
}
.bili-dynamic-live-cover {
  width: 140px;
  height: 80px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
  background: #05070c;
}
.bili-dynamic-live-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.bili-dynamic-live-badge {
  align-self: flex-start;
  font-size: 11px;
  color: #fff;
  background: #fb7299;
  border-radius: 4px;
  padding: 1px 6px;
}
.bili-dynamic-live-info strong {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-dynamic-live-info small {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-dynamic-forward {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border-left: 3px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  padding-left: 10px;
}
.bili-dynamic-forward-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bili-dynamic-forward-head strong {
  font-size: 13px;
}
.bili-dynamic-forward-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}
.bili-dynamic-stats {
  display: flex;
  gap: 18px;
  align-items: center;
  padding-top: 4px;
}
.bili-dynamic-stat {
  border: 0;
  background: transparent;
  padding: 0;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  cursor: pointer;
}
button.bili-dynamic-stat {
  color: hsl(var(--foreground, 0 0% 100%));
}
.bili-dynamic-stat:hover {
  color: hsl(var(--primary, 240 100% 60%));
}
.bili-dynamic-load-more {
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--foreground, 0 0% 100%));
  padding: 8px 0;
  font-size: 13px;
  cursor: pointer;
}
.bili-dynamic-load-more:hover {
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 40%, transparent);
}
.bili-dynamic-load-more:disabled {
  opacity: 0.6;
  cursor: default;
}
/* 发布动态 */
.bili-mine-publish {
  padding: 0 20px 8px;
  display: flex;
  justify-content: flex-end;
}
.bili-dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
}
.bili-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(520px, calc(100vw - 48px));
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 12px;
  background: hsl(var(--card, 0 0% 100%));
  padding: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
}
.bili-dialog-title {
  font-size: 15px;
  font-weight: 600;
}
.bili-dynamic-publish-input {
  width: 100%;
  min-height: 120px;
  resize: vertical;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 40%, transparent);
  color: hsl(var(--foreground, 0 0% 100%));
  padding: 10px 12px;
  font-size: 14px;
  outline: none;
}
.bili-dynamic-publish-count {
  text-align: right;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
/* 动态详情 */
.bili-dyn-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px 24px;
}
.bili-dyn-detail-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.bili-dyn-detail-section-title {
  font-size: 14px;
  font-weight: 600;
  margin-top: 4px;
}
.bili-dyn-detail-images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.bili-dyn-detail-image-wrap {
  border: 0;
  border-radius: 8px;
  overflow: hidden;
  padding: 0;
  cursor: zoom-in;
  background: transparent;
}
.bili-dyn-detail-image {
  width: 100%;
  aspect-ratio: 16 / 10;
  object-fit: cover;
  display: block;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 60%, transparent);
}
.bili-dyn-detail-forward {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bili-dyn-forwards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bili-dyn-forward-entry {
  display: flex;
  gap: 10px;
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 40%, transparent);
  padding: 10px;
}
.bili-dyn-forward-entry-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.bili-dyn-forward-entry-body strong {
  font-size: 13px;
}
.bili-dyn-forward-entry-body small {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-dyn-forward-entry-body p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}
/* 图片大图预览 */
.bili-image-preview-backdrop {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.8);
  cursor: zoom-out;
}
.bili-image-preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  max-width: min(900px, calc(100vw - 48px));
}
.bili-image-preview {
  max-width: 100%;
  max-height: 78vh;
  border-radius: 8px;
  object-fit: contain;
}
.bili-image-preview-nav {
  display: flex;
  gap: 16px;
  align-items: center;
  font-size: 13px;
  color: #fff;
}
.bili-image-preview-nav-btn {
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 6px;
  background: transparent;
  color: #fff;
  padding: 4px 12px;
  cursor: pointer;
}
.bili-image-preview-nav-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
/* 空间动态 tab */
.bili-space-tabs {
  display: flex;
  gap: 8px;
  padding: 0 20px 8px;
}
.bili-space-tab {
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  padding: 6px 10px;
  font-size: 14px;
  cursor: pointer;
}
.bili-space-tab-active {
  color: hsl(var(--foreground, 0 0% 100%));
  border-bottom-color: hsl(var(--primary, 240 100% 60%));
}
.bili-dynamic-card-wrap {
  position: relative;
}
.bili-dynamic-top-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 2;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 6px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 85%, transparent);
  color: hsl(var(--foreground, 0 0% 100%));
  font-size: 12px;
  padding: 3px 10px;
  cursor: pointer;
}
.bili-dynamic-top-button:hover {
  background: hsl(var(--primary, 240 100% 60%));
  color: #fff;
}
.bili-dynamic-top-button:disabled {
  opacity: 0.6;
  cursor: default;
}
/* ===== 私信/通知（P5） ===== */
.bili-nav-badge {
  position: absolute;
  top: -4px;
  right: -6px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  background: #fb7299;
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  padding: 0 4px;
}
.bili-nav-tabs {
  position: relative;
}
.bili-messages {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px 24px;
}
.bili-message-session {
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 55%, transparent);
  padding: 12px 14px;
  cursor: pointer;
  text-align: left;
  color: hsl(var(--foreground, 0 0% 100%));
  transition: transform 160ms var(--bili-ease), box-shadow 160ms var(--bili-ease);
}
.bili-message-session:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
}
.bili-message-session-avatar {
  flex-shrink: 0;
}
.bili-message-session-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.bili-message-session-body strong {
  font-size: 14px;
}
.bili-message-session-body small {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-message-badge {
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  background: #fb7299;
  color: #fff;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  padding: 0 5px;
  flex-shrink: 0;
}
.bili-chat {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px 20px 24px;
  height: 100%;
  min-height: 0;
}
.bili-chat-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding: 4px;
}
.bili-chat-load-more {
  align-self: center;
  border: 0;
  background: transparent;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  font-size: 12px;
  cursor: pointer;
  padding: 4px 10px;
}
.bili-chat-bubble {
  display: flex;
  flex-direction: column;
  gap: 3px;
  max-width: 72%;
  align-self: flex-start;
}
.bili-chat-bubble-mine {
  align-self: flex-end;
  align-items: flex-end;
}
.bili-chat-bubble-content {
  border-radius: 12px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 60%, transparent);
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}
.bili-chat-bubble-mine .bili-chat-bubble-content {
  background: hsl(var(--primary, 240 100% 60%));
  color: #fff;
}
.bili-chat-bubble small {
  font-size: 11px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-chat-input {
  display: flex;
  gap: 8px;
  align-items: center;
}
.bili-chat-input-field {
  flex: 1;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 40%, transparent);
  color: hsl(var(--foreground, 0 0% 100%));
  padding: 8px 12px;
  font-size: 14px;
  outline: none;
}
.bili-notifications {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 20px 24px;
}
.bili-notify-filters {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.bili-notify-filter {
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  padding: 5px 10px;
  font-size: 13px;
  cursor: pointer;
}
.bili-notify-filter-active {
  color: hsl(var(--foreground, 0 0% 100%));
  border-bottom-color: hsl(var(--primary, 240 100% 60%));
}
.bili-notify-entry {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 44%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 45%, transparent);
  padding: 12px 14px;
  cursor: pointer;
  text-align: left;
  color: hsl(var(--foreground, 0 0% 100%));
}
.bili-notify-entry:hover {
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 90%)) 65%, transparent);
}
.bili-notify-entry-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.bili-notify-entry-body strong {
  font-size: 13px;
}
.bili-notify-entry-desc {
  font-size: 13px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bili-notify-entry-body small {
  font-size: 11px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-notify-tag {
  margin-left: 6px;
  font-size: 10px;
  color: hsl(var(--primary, 240 100% 60%));
  border: 1px solid hsl(var(--primary, 240 100% 60%));
  border-radius: 4px;
  padding: 0 4px;
  vertical-align: 1px;
}
.bili-mine-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  padding: 0 20px 8px;
}

/* ---------- P6 直播 feed ---------- */
.bili-live-feed {
  display: grid;
  gap: 12px;
}
.bili-live-areas {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding: 8px 2px;
}
.bili-live-subareas {
  margin-top: -6px;
}
.bili-live-area {
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-live-area-active {
  background: color-mix(in srgb, hsl(var(--primary, 240 100% 60%)) 14%, transparent);
  border-color: hsl(var(--primary, 240 100% 60%));
  color: hsl(var(--primary, 240 100% 60%));
}
.bili-live-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}
.bili-live-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 8px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 220ms var(--bili-spring), box-shadow 220ms var(--bili-ease);
}
.bili-live-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
}
.bili-live-card-cover {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 40%, transparent);
}
.bili-live-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.bili-live-card-badge {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 10px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 4px;
  color: #fff;
  background: rgba(240, 71, 71, 0.9);
}
.bili-live-card-online {
  position: absolute;
  right: 6px;
  bottom: 6px;
  font-size: 11px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 4px;
  color: #fff;
  background: rgba(0, 0, 0, 0.55);
}
.bili-live-card-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.7em;
}
.bili-live-card-owner {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.bili-live-card-face {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
  flex: none;
}
.bili-live-card-name {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-live-card-area {
  font-size: 11px;
  color: hsl(var(--primary, 240 100% 60%));
  margin-left: auto;
  flex: none;
}
.bili-live-empty {
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-live-more {
  display: flex;
  justify-content: center;
  padding: 6px 0;
}

/* ---------- P6 直播间视图 ---------- */
.bili-live {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 14px;
  padding: 12px;
  align-items: start;
}
.bili-live-main {
  display: grid;
  gap: 12px;
  min-width: 0;
}
.bili-live-player {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: #000;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
}
.bili-live-video {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
}
.bili-live-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.55);
  text-align: center;
  padding: 16px;
}
.bili-live-room-card {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
}
.bili-live-room-head {
  display: grid;
  gap: 6px;
}
.bili-live-room-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
}
.bili-live-room-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-live-room-status {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  background: rgba(120, 120, 120, 0.25);
}
.bili-live-room-status-on {
  background: rgba(240, 71, 71, 0.16);
  color: #f04747;
}
.bili-live-room-desc {
  font-size: 13px;
  color: hsl(var(--muted-foreground, 0 0% 55%));
  line-height: 1.6;
  margin: 0;
  max-height: 3.2em;
  overflow: hidden;
}
.bili-live-room-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-live-room-uid {
  border: none;
  background: none;
  color: hsl(var(--primary, 240 100% 60%));
  cursor: pointer;
  font-size: 12px;
  padding: 0;
}
.bili-live-side {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  gap: 8px;
  min-height: 420px;
  max-height: calc(100vh - 140px);
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
  padding: 10px;
}
.bili-live-danmaku-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  padding-bottom: 6px;
  border-bottom: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 40%, transparent);
}
.bili-live-ws {
  font-size: 11px;
  font-weight: 400;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-live-ws-on {
  color: #46b250;
}
.bili-live-danmaku-list {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 2px;
  font-size: 13px;
  min-height: 0;
}
.bili-live-danmaku-item {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 4px;
  line-height: 1.5;
  animation: bili-fade-in 220ms var(--bili-ease);
}
.bili-live-danmaku-user {
  font-weight: 600;
  color: hsl(var(--primary, 240 100% 60%));
}
.bili-live-danmaku-text {
  min-width: 0;
  overflow-wrap: anywhere;
}
.bili-live-danmaku-gift {
  background: rgba(255, 215, 64, 0.1);
  border: 1px solid rgba(255, 215, 64, 0.35);
  border-radius: 6px;
  padding: 3px 8px;
}
.bili-live-danmaku-gift .bili-live-danmaku-user {
  color: #e0a800;
}
.bili-live-danmaku-sc {
  background: rgba(96, 165, 250, 0.12);
  border: 1px solid rgba(96, 165, 250, 0.4);
  border-radius: 6px;
  padding: 4px 8px;
}
.bili-live-danmaku-sc .bili-live-danmaku-user {
  color: #60a5fa;
}
.bili-live-danmaku-detail {
  color: #e0a800;
  font-weight: 700;
}
.bili-live-danmaku-system {
  color: hsl(var(--muted-foreground, 0 0% 50%));
  font-size: 12px;
  width: 100%;
  text-align: center;
}
.bili-live-send {
  display: flex;
  gap: 8px;
}
.bili-live-send-input {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 40%, transparent);
  color: inherit;
  font-size: 13px;
  outline: none;
}
.bili-live-send-input:focus {
  border-color: hsl(var(--primary, 240 100% 60%));
}
.bili-live-send-btn {
  flex: none;
  padding: 7px 14px;
  border-radius: 8px;
  border: none;
  background: hsl(var(--primary, 240 100% 60%));
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}
.bili-live-send-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.bili-live-send-error {
  font-size: 12px;
  color: #f04747;
}
.bili-live-quality {
  position: relative;
}
.bili-live-quality-btn {
  width: 100%;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  background: transparent;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.bili-live-quality-menu {
  position: absolute;
  right: 0;
  bottom: 110%;
  z-index: 30;
  display: grid;
  gap: 2px;
  min-width: 140px;
  padding: 6px;
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 92%, transparent);
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  animation: bili-popover-in 160ms var(--bili-ease);
}
.bili-live-quality-option {
  text-align: left;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: none;
  color: inherit;
  font-size: 12px;
  cursor: pointer;
}
.bili-live-quality-option:hover {
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 50%, transparent);
}
.bili-live-quality-option-active {
  color: hsl(var(--primary, 240 100% 60%));
  font-weight: 600;
}
@media (max-width: 900px) {
  .bili-live {
    grid-template-columns: 1fr;
  }
  .bili-live-side {
    max-height: 480px;
    min-height: 360px;
  }
}

.bili-article-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 14px;
}


/* ---------- P8 专栏动态卡片体 ---------- */
.bili-dynamic-article {
  display: flex;
  gap: 10px;
  padding: 8px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 45%, transparent);
}
.bili-dynamic-article-cover {
  flex: none;
  width: 96px;
  border-radius: 8px;
  overflow: hidden;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 40%, transparent);
}
.bili-dynamic-article-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  aspect-ratio: 16 / 10;
}
.bili-dynamic-article-info {
  display: grid;
  gap: 4px;
  min-width: 0;
  align-content: center;
}
.bili-dynamic-article-badge {
  justify-self: start;
  font-size: 10px;
  color: hsl(var(--primary, 240 100% 60%));
  border: 1px solid hsl(var(--primary, 240 100% 60%));
  border-radius: 4px;
  padding: 0 4px;
}
.bili-dynamic-article-info strong {
  font-size: 13px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bili-dynamic-article-info small {
  font-size: 11px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-dynamic-article-desc {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
.bili-dyn-article-read {
  width: 100%;
  margin-top: 8px;
  padding: 7px 0;
  border-radius: 8px;
  border: 1px solid hsl(var(--primary, 240 100% 60%));
  background: none;
  color: hsl(var(--primary, 240 100% 60%));
  font-size: 13px;
  cursor: pointer;
}
.bili-dyn-article-read:hover {
  background: color-mix(in srgb, hsl(var(--primary, 240 100% 60%)) 12%, transparent);
}

/* ---------- P8 专栏阅读页 ---------- */
.bili-article {
  display: grid;
  gap: 14px;
  max-width: 820px;
  margin: 0 auto;
  padding: 14px 18px;
}
.bili-article-head {
  display: grid;
  gap: 10px;
  padding-bottom: 12px;
  border-bottom: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 40%, transparent);
}
.bili-article-title {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.45;
  margin: 0;
}
.bili-article-author {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-article-author-main {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  color: hsl(var(--primary, 240 100% 60%));
  cursor: pointer;
  padding: 0;
  font-size: 13px;
}
.bili-article-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
}
.bili-article-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.bili-article-stat {
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 50%, transparent);
  color: inherit;
  border-radius: 8px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}
.bili-article-stat:disabled {
  opacity: 0.5;
  cursor: default;
}
.bili-article-stat-active {
  color: hsl(var(--primary, 240 100% 60%));
  border-color: hsl(var(--primary, 240 100% 60%));
}
.bili-article-coin-message {
  font-size: 12px;
  color: hsl(var(--primary, 240 100% 60%));
}
.bili-article-body {
  font-size: 15px;
  line-height: 1.9;
  color: hsl(var(--foreground, 0 0% 98%));
  overflow-wrap: anywhere;
}
.bili-article-para {
  margin: 0 0 14px;
}
.bili-article-image {
  margin: 12px 0;
}
.bili-article-image img {
  max-width: 100%;
  border-radius: 8px;
  display: block;
}
.bili-article-html img {
  max-width: 100%;
  border-radius: 8px;
  display: block;
  margin: 10px auto;
}
.bili-article-html p {
  margin: 0 0 14px;
}
.bili-article-html a {
  color: hsl(var(--primary, 240 100% 60%));
}
.bili-article-html blockquote {
  border-left: 3px solid hsl(var(--primary, 240 100% 60%));
  margin: 10px 0;
  padding: 4px 12px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 40%, transparent);
  border-radius: 0 6px 6px 0;
}
.bili-article-html pre,
.bili-article-html code {
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
  border-radius: 6px;
  font-family: Consolas, monospace;
  font-size: 13px;
}
.bili-article-html pre {
  padding: 10px 12px;
  overflow-x: auto;
}
.bili-article-html table {
  border-collapse: collapse;
  margin: 10px 0;
}
.bili-article-html th,
.bili-article-html td {
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 45%, transparent);
  padding: 6px 10px;
}
.bili-article-plain {
  white-space: pre-wrap;
  font-size: 14px;
}
.bili-article-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.bili-article-tag {
  font-size: 12px;
  color: hsl(var(--primary, 240 100% 60%));
  border: 1px solid hsl(var(--primary, 240 100% 60%));
  border-radius: 10px;
  padding: 2px 10px;
}

/* ---------- P8 专栏卡片（UP 主页） ---------- */
.bili-article-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 10px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 55%, transparent);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 220ms var(--bili-spring), box-shadow 220ms var(--bili-ease);
}
.bili-article-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.14);
}
.bili-article-card-cover {
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 40%, transparent);
}
.bili-article-card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.bili-article-card-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bili-article-card-summary {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.6;
}
.bili-article-card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}

.bili-video-notes-btn {
  margin-left: 8px;
  border: 1px solid hsl(var(--primary, 240 100% 60%));
  background: none;
  color: hsl(var(--primary, 240 100% 60%));
  border-radius: 8px;
  padding: 1px 10px;
  font-size: 11px;
  cursor: pointer;
  vertical-align: 1px;
}
.bili-video-notes-btn:hover {
  background: color-mix(in srgb, hsl(var(--primary, 240 100% 60%)) 12%, transparent);
}

/* ---------- P8 笔记弹层 ---------- */
.bili-note-backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}
.bili-note-panel {
  width: min(560px, 92vw);
  max-height: 82vh;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-radius: 12px;
  background: hsl(var(--card, 0 0% 100%));
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 55%, transparent);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  animation: bili-popover-in 180ms var(--bili-ease);
}
.bili-note-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 40%, transparent);
}
.bili-note-head strong {
  font-size: 14px;
}
.bili-note-close {
  border: none;
  background: none;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  font-size: 18px;
  cursor: pointer;
  padding: 2px 6px;
}
.bili-note-list {
  overflow-y: auto;
  display: grid;
  gap: 8px;
  padding: 12px 16px;
}
.bili-note-item {
  display: grid;
  gap: 6px;
  text-align: left;
  padding: 10px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 50%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--muted, 0 0% 40%)) 45%, transparent);
  cursor: pointer;
  color: inherit;
}
.bili-note-item:hover {
  border-color: hsl(var(--primary, 240 100% 60%));
}
.bili-note-item-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}
.bili-note-item-summary {
  font-size: 12px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.bili-note-item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: hsl(var(--muted-foreground, 0 0% 50%));
}
.bili-note-private-badge {
  color: #e0a800;
  border: 1px solid rgba(224, 168, 0, 0.5);
  border-radius: 4px;
  padding: 0 4px;
  font-size: 10px;
}
.bili-note-body {
  overflow-y: auto;
  padding: 14px 18px;
  display: grid;
  gap: 12px;
}
.bili-note-body h2 {
  font-size: 17px;
  margin: 0;
  line-height: 1.5;
}
.bili-note-body .bili-article-para {
  font-size: 14px;
  line-height: 1.8;
  margin-bottom: 10px;
}
.bili-note-body .bili-article-image img {
  max-width: 100%;
  border-radius: 8px;
}
.bili-note-back {
  border: none;
  background: none;
  color: hsl(var(--primary, 240 100% 60%));
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}

/* ===== P9/* ===== P9 布局改造：侧边栏 + 顶栏搜索（参考 BewlyBewly） ===== */
.bili-shell-body {
  display: flex;
  flex: 1 1 auto;
  min-height: 0;
  gap: 14px;
  margin-top: 14px;
}
.bili-shell-content {
  flex: 1 1 auto;
  min-width: 0;
  overflow-y: auto;
  border-radius: 14px;
}
.bili-sidebar {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 0 0 auto;
  width: 184px;
  padding: 10px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 38%, transparent);
  backdrop-filter: blur(14px);
  transition: width 240ms var(--bili-spring);
  overflow: hidden;
}
.bili-sidebar-collapsed {
  width: 58px;
}
.bili-sidebar-nav {
  display: grid;
  gap: 4px;
}
.bili-sidebar-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  padding: 6px 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  transition: background 160ms var(--bili-ease), color 160ms var(--bili-ease);
}
.bili-sidebar-item:hover {
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 60%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-sidebar-item-active {
  background: color-mix(in srgb, var(--bili-accent) 16%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-sidebar-item-active:hover {
  background: color-mix(in srgb, var(--bili-accent) 22%, transparent);
}
.bili-sidebar-glyph {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex: 0 0 auto;
  border-radius: 8px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 55%, transparent);
  font-size: 13px;
  font-weight: 700;
  transition: background 160ms var(--bili-ease);
}
.bili-sidebar-item-active .bili-sidebar-glyph {
  background: color-mix(in srgb, var(--bili-accent) 70%, #111827 30%);
  color: #fff;
}
.bili-sidebar-label {
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 160ms var(--bili-ease);
}
.bili-sidebar-collapsed .bili-sidebar-label,
.bili-sidebar-collapsed .bili-sidebar-dot {
  display: none;
}
.bili-sidebar-collapsed .bili-sidebar-item {
  justify-content: center;
  padding: 6px 0;
}
.bili-sidebar-collapse {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 40px;
  margin-top: 10px;
  padding: 6px 8px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: hsl(var(--muted-foreground, 240 5% 64%));
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}
.bili-sidebar-collapse:hover {
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 60%, transparent);
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-sidebar-collapsed .bili-sidebar-collapse {
  justify-content: center;
  padding: 6px 0;
}
.bili-sidebar-dot {
  width: 6px;
  height: 6px;
  margin-left: auto;
  flex: 0 0 auto;
  border-radius: 3px;
  background: var(--bili-accent);
}
.bili-top-search {
  display: flex;
  align-items: center;
  justify-self: center;
  gap: 8px;
  width: min(480px, 100%);
  min-width: 0;
}
.bili-top-search-input {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 36px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 40%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 42%, transparent);
  color: inherit;
  font: inherit;
  font-size: 13px;
  padding: 0 12px;
  outline: none;
  transition: border-color 160ms var(--bili-ease);
}
.bili-top-search-input:focus {
  border-color: color-mix(in srgb, var(--bili-accent) 60%, transparent);
}
.bili-top-search-input::placeholder {
  color: hsl(var(--muted-foreground, 240 5% 64%));
}
.bili-notify-button {
  position: relative;
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  padding: 0;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 42%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 52%, transparent);
  color: hsl(var(--muted-foreground, 240 5% 64%));
  cursor: pointer;
}
.bili-notify-button:hover {
  color: hsl(var(--foreground, 0 0% 98%));
}
.bili-notify-glyph {
  font-size: 13px;
  font-weight: 700;
}
.bili-notify-glyph svg {
  display: block;
}
.bili-notify-button .bili-nav-badge {
  top: -5px;
  right: -7px;
}
.bili-home-toolbar {
  display: flex;
  justify-content: flex-end;
}
.bili-search-page {
  display: grid;
  gap: 14px;
}
/* ===== P9 阶段 2：侧边栏位置 + 我的概览 + 账号内容页 ===== */
.bili-sidebar-right {
  order: 2;
}
.bili-sidebar-right + .bili-shell-content {
  order: 1;
}
.bili-page-library {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.bili-live-home {
  display: grid;
  gap: 14px;
  min-width: 0;
}
.bili-mine-entries {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}
.bili-mine-entry {
  display: grid;
  place-items: center;
  gap: 10px;
  min-height: 96px;
  padding: 14px;
  border: 1px solid color-mix(in srgb, hsl(var(--border, 0 0% 100%)) 36%, transparent);
  border-radius: 14px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 38%, transparent);
  backdrop-filter: blur(14px);
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: background 160ms var(--bili-ease), transform 160ms var(--bili-ease);
}
.bili-mine-entry:hover {
  background: color-mix(in srgb, var(--bili-accent) 14%, transparent);
  transform: translateY(-1px);
}
.bili-mine-entry-glyph {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: color-mix(in srgb, hsl(var(--card, 0 0% 100%)) 55%, transparent);
  font-size: 16px;
  font-weight: 700;
}
.bili-mine-entry-label {
  font-size: 13px;
}
`;
