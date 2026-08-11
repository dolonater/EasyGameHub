export const cssText = `
.bili-shell {
  --bili-accent: #fb7299;
  --bili-cyan: #23ade5;
  box-sizing: border-box;
  min-height: min(760px, 100%);
  padding: 16px;
  color: var(--foreground, #f6f7fb);
}
.bili-shell *,
.bili-shell *::before,
.bili-shell *::after {
  box-sizing: border-box;
  letter-spacing: 0;
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
  color: var(--muted-foreground, #a8adbd);
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
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 70%, transparent);
  color: var(--foreground, #f6f7fb);
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
}
.bili-search input::placeholder {
  color: var(--muted-foreground, #a8adbd);
}
.bili-login-panel,
.bili-content-panel,
.bili-empty-panel,
.bili-library {
  min-height: 360px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 78%, transparent);
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
  background: color-mix(in srgb, var(--muted, #4b5563) 70%, transparent);
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
  color: var(--muted-foreground, #a8adbd);
  border: 1px dashed color-mix(in srgb, var(--border, #ffffff) 55%, transparent);
  background: color-mix(in srgb, var(--muted, #4b5563) 26%, transparent);
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
  border-color: color-mix(in srgb, var(--border, #ffffff) 48%, transparent);
  background: color-mix(in srgb, var(--card, #272b36) 52%, transparent);
  color: var(--foreground, #f6f7fb);
}
.bili-link-button {
  display: inline-grid;
  place-items: center;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 48%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 52%, transparent);
  color: var(--foreground, #f6f7fb);
  padding: 0 12px;
  font-size: 13px;
  text-decoration: none;
}
.bili-status {
  margin: 0;
  color: color-mix(in srgb, var(--bili-cyan) 80%, var(--foreground, #f6f7fb));
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
  color: var(--muted-foreground, #a8adbd);
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
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.bili-cover-wrap {
  position: relative;
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 8px;
  background: color-mix(in srgb, var(--muted, #4b5563) 38%, transparent);
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
  color: var(--muted-foreground, #a8adbd);
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
  color: var(--muted-foreground, #a8adbd);
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
  background: color-mix(in srgb, var(--border, #ffffff) 34%, transparent);
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
  color: var(--muted-foreground, #a8adbd);
  text-align: center;
  font-size: 13px;
}
.bili-state-error {
  color: color-mix(in srgb, #ef4444 82%, var(--foreground, #f6f7fb));
}
.bili-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.bili-tab {
  min-height: 32px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 50%, transparent);
  color: var(--muted-foreground, #a8adbd);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.bili-tab-active {
  border-color: color-mix(in srgb, var(--bili-accent) 62%, transparent);
  color: var(--foreground, #f6f7fb);
}
.bili-library-empty {
  min-height: 86px;
  gap: 5px;
}
.bili-library-empty strong {
  color: var(--foreground, #f6f7fb);
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
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 38%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 44%, transparent);
  color: var(--foreground, #f6f7fb);
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
  color: var(--muted-foreground, #a8adbd);
  font-size: 11px;
}
.bili-folder-item-active {
  border-color: color-mix(in srgb, var(--bili-accent) 70%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 18%, var(--card, #272b36));
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
  color: var(--muted-foreground, #a8adbd);
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
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 78%, transparent);
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
  color: var(--muted-foreground, #a8adbd);
  text-align: center;
}
.bili-player-overlay strong {
  color: var(--foreground, #f6f7fb);
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
  grid-template-columns: auto auto minmax(120px, 1fr) auto auto 88px 76px auto auto;
  gap: 8px;
  align-items: center;
  min-height: 52px;
  padding: 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0.2));
}
.bili-player-icon-button,
.bili-player-rate {
  min-height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-radius: 8px;
  background: rgba(12, 16, 24, 0.72);
  color: #fff;
  font: inherit;
  font-size: 12px;
}
.bili-player-icon-button {
  min-width: 52px;
  padding: 0 10px;
  cursor: pointer;
}
.bili-player-icon-button:disabled,
.bili-player-rate:disabled,
.bili-player-seek:disabled,
.bili-player-volume:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.bili-player-time {
  min-width: 45px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 12px;
  text-align: center;
}
.bili-player-seek,
.bili-player-volume {
  width: 100%;
  accent-color: var(--bili-accent);
}
.bili-player-volume {
  min-width: 74px;
}
.bili-player-rate {
  width: 76px;
  padding: 0 6px;
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
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 72%, transparent);
  padding: 8px;
}
.bili-danmaku-input input {
  min-width: 0;
  min-height: 32px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 36%, transparent);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.18);
  color: var(--foreground, #f6f7fb);
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
  color: var(--muted-foreground, #a8adbd);
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
  color: var(--muted-foreground, #a8adbd);
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
.bili-interaction-button {
  display: inline-grid;
  grid-template-columns: auto auto;
  align-items: center;
  gap: 6px;
  min-width: max-content;
  min-height: 38px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 40%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 54%, transparent);
  color: var(--foreground, #f6f7fb);
  padding: 0 12px;
}
.bili-interaction-button small {
  color: var(--muted-foreground, #a8adbd);
  font-size: 11px;
}
.bili-interaction-button-active {
  border-color: color-mix(in srgb, var(--bili-accent) 68%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 18%, var(--card, #272b36));
}
.bili-interaction-button-active small {
  color: color-mix(in srgb, var(--bili-accent) 82%, #fff);
}
.bili-popover-panel {
  display: grid;
  gap: 12px;
  width: min(320px, 100%);
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 44%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 88%, #05070c 12%);
  padding: 12px;
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.26);
}
.bili-favorite-popover {
  width: min(420px, 100%);
}
.bili-popover-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.bili-popover-heading strong {
  font-size: 14px;
}
.bili-popover-heading button {
  border: 0;
  background: transparent;
  color: var(--muted-foreground, #a8adbd);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
}
.bili-segment-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.bili-segment {
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 40%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 50%, transparent);
  color: var(--foreground, #f6f7fb);
  cursor: pointer;
  font: inherit;
}
.bili-segment-active {
  border-color: color-mix(in srgb, var(--bili-accent) 70%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 20%, var(--card, #272b36));
}
.bili-owner-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 58px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 38%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 58%, transparent);
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
  background: color-mix(in srgb, var(--muted, #4b5563) 52%, transparent);
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
  color: var(--muted-foreground, #a8adbd);
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
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 48%, transparent);
  color: var(--foreground, #f6f7fb);
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
  color: var(--muted-foreground, #a8adbd);
  font-size: 11px;
}
.bili-page-item-active {
  border-color: color-mix(in srgb, var(--bili-accent) 70%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 20%, var(--card, #272b36));
}
.bili-quality-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 32px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 38%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 44%, transparent);
  color: var(--foreground, #f6f7fb);
  padding: 0 10px;
  text-align: left;
  font: inherit;
  cursor: pointer;
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
  background: color-mix(in srgb, var(--bili-accent) 20%, var(--card, #272b36));
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
  color: var(--muted-foreground, #a8adbd);
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
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 14px;
  background: rgba(14, 18, 30, 0.58);
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
  color: var(--muted-foreground, #a8adbd);
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
.bili-comment-editor textarea,
.bili-comment-reply-editor input,
.bili-comment-report input,
.bili-comment-report select {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--foreground, #f5f7fb);
  min-width: 0;
  outline: none;
}
.bili-comment-editor textarea {
  min-height: 86px;
  padding: 10px 12px;
  resize: vertical;
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
.bili-comment-editor-actions span,
.bili-comment-footer,
.bili-comment-meta small,
.bili-comment-actions button,
.bili-comment-reply button {
  color: var(--muted-foreground, #a8adbd);
  font-size: 12px;
}
.bili-comment-list,
.bili-comment-top-list {
  display: grid;
  gap: 12px;
}
.bili-comment-card {
  border: 1px solid rgba(255, 255, 255, 0.09);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.045);
  display: grid;
  gap: 12px;
  grid-template-columns: 42px minmax(0, 1fr);
  padding: 12px;
  min-width: 0;
}
.bili-comment-card-top {
  border-color: rgba(0, 174, 236, 0.35);
  background: rgba(0, 174, 236, 0.08);
}
.bili-comment-avatar {
  border-radius: 50%;
  height: 42px;
  object-fit: cover;
  width: 42px;
}
.bili-comment-body {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.bili-comment-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
}
.bili-comment-meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-comment-meta span {
  border-radius: 999px;
  background: rgba(0, 174, 236, 0.18);
  color: #d9f4ff;
  font-size: 11px;
  padding: 2px 6px;
}
.bili-comment-message {
  color: var(--foreground, #f5f7fb);
  line-height: 1.65;
  margin: 0;
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
  color: var(--foreground, #f5f7fb);
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
  color: var(--muted-foreground, #a8adbd);
  display: grid;
  gap: 8px;
  font-size: 12px;
}
.bili-setting-field select {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--foreground, #f5f7fb);
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
  color: var(--muted-foreground, #a8adbd);
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
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 36%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 48%, transparent);
}
.bili-nav-tab {
  min-width: 64px;
  min-height: 32px;
  border-radius: 7px;
  color: var(--muted-foreground, #a8adbd);
  cursor: pointer;
}
.bili-nav-tab-active {
  background: color-mix(in srgb, var(--bili-accent) 18%, var(--card, #272b36));
  color: var(--foreground, #f6f7fb);
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
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 52%, transparent);
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
  background: color-mix(in srgb, var(--bili-cyan) 30%, var(--card, #272b36));
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
  color: var(--muted-foreground, #a8adbd);
  font-size: 12px;
}
.bili-feed-tabs {
  display: inline-flex;
  gap: 8px;
}
.bili-feed-tab {
  min-width: 72px;
  min-height: 34px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 36%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 44%, transparent);
  color: var(--muted-foreground, #a8adbd);
  cursor: pointer;
}
.bili-feed-tab-active {
  border-color: color-mix(in srgb, var(--bili-accent) 66%, transparent);
  background: color-mix(in srgb, var(--bili-accent) 18%, var(--card, #272b36));
  color: var(--foreground, #f6f7fb);
}
.bili-video-grid {
  grid-template-columns: repeat(auto-fill, minmax(196px, 1fr));
  gap: 16px 14px;
}
.bili-mine {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
  max-width: 1220px;
  margin: 0 auto;
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
}
.bili-watch-tabs {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  padding: 6px;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 70%, transparent);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
}
.bili-watch-tab {
  display: grid;
  place-items: center;
  gap: 1px;
  min-width: 0;
  min-height: 38px;
  border-radius: 7px;
  color: var(--muted-foreground, #a8adbd);
  cursor: pointer;
}
.bili-watch-tab span,
.bili-watch-tab small {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bili-watch-tab small {
  font-size: 10px;
}
.bili-watch-tab-active {
  background: color-mix(in srgb, var(--bili-accent) 20%, var(--card, #272b36));
  color: var(--foreground, #f6f7fb);
}
.bili-watch-tab-panel {
  display: grid;
  min-width: 0;
  max-height: calc(100vh - 110px);
  overflow: auto;
  border: 1px solid color-mix(in srgb, var(--border, #ffffff) 42%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--card, #272b36) 76%, transparent);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
}
.bili-sidebar-section {
  display: grid;
  gap: 14px;
  align-content: start;
  min-width: 0;
  padding: 14px;
}
.bili-comments {
  min-height: 0;
  max-height: none;
  margin: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
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
@media (max-width: 640px) {
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
  }
  .bili-watch-tabs {
    grid-template-columns: repeat(5, minmax(48px, 1fr));
    overflow-x: auto;
  }
  .bili-watch-tab-panel {
    max-height: none;
  }
  .bili-player-shell {
    min-height: 180px;
  }
  .bili-player-controls {
    grid-template-columns: auto auto minmax(80px, 1fr) auto auto;
  }
  .bili-player-volume,
  .bili-player-rate,
  .bili-player-controls .bili-player-icon-button:last-child,
  .bili-player-controls .bili-player-time:nth-of-type(2) {
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
