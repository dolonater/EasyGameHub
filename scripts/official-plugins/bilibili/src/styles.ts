export const cssText = `
.bili-shell {
  --bili-accent: #fb7299;
  --bili-cyan: #23ade5;
  --bili-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --bili-spring: cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  min-height: min(760px, 100%);
  padding: 16px;
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
  border-radius: 10px;
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
  max-width: 1220px;
  min-height: 52px;
  margin: 0 auto 16px;
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
`;
