export const cssText = `
.netease-shell {
  --nm-accent: var(--accent, #ff4d4f);
  --nm-bg: color-mix(in srgb, var(--background, #151820) 78%, var(--card, #272b36));
  --nm-surface: color-mix(in srgb, var(--card, #272b36) 82%, white);
  --nm-card: color-mix(in srgb, var(--nm-surface) 76%, transparent);
  --nm-card-solid: color-mix(in srgb, var(--nm-surface) 92%, var(--background, #151820));
  --nm-elevated: color-mix(in srgb, var(--nm-surface) 84%, white);
  --nm-border: color-mix(in srgb, var(--border, #ffffff) 58%, transparent);
  --nm-soft-border: color-mix(in srgb, var(--border, #ffffff) 36%, transparent);
  --nm-text: var(--foreground, #f6f7fb);
  --nm-muted: var(--muted-foreground, #a8adbd);
  --nm-ease: cubic-bezier(0.2, 0.8, 0.2, 1);
  --nm-spring: cubic-bezier(0.16, 1, 0.3, 1);
  box-sizing: border-box;
  position: relative;
  height: min(840px, 100%);
  min-height: 0;
  padding: 16px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  overflow: hidden;
  color: var(--nm-text);
  background-color: var(--nm-bg);
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  border-radius: 8px;
  animation: nmShellIn 360ms var(--nm-spring);
}
.netease-shell *,
.netease-shell *::before,
.netease-shell *::after {
  box-sizing: border-box;
  letter-spacing: 0;
}
.nm-page-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 18% 8%, color-mix(in srgb, var(--nm-accent) 18%, transparent), transparent 34%),
    radial-gradient(circle at 86% 16%, color-mix(in srgb, #5ed9c8 16%, transparent), transparent 32%),
    linear-gradient(120deg, color-mix(in srgb, var(--background, #151820) 74%, transparent), color-mix(in srgb, var(--card, #272b36) 38%, transparent) 46%, color-mix(in srgb, var(--background, #151820) 72%, transparent)),
    linear-gradient(0deg, color-mix(in srgb, var(--background, #151820) 52%, transparent), transparent 52%, color-mix(in srgb, var(--background, #151820) 42%, transparent));
  pointer-events: none;
  transition: opacity 360ms var(--nm-ease), filter 520ms var(--nm-ease);
  animation: nmBackdropDrift 18s ease-in-out infinite alternate;
}
.nm-has-cover .nm-page-backdrop {
  backdrop-filter: blur(24px) saturate(128%);
  -webkit-backdrop-filter: blur(24px) saturate(128%);
}
.nm-playing .nm-page-backdrop {
  filter: saturate(112%);
}
.app-plugin-page-top-nav .netease-shell {
  height: min(840px, calc(100% + 72px));
  margin-top: -72px;
  padding-top: 88px;
}
.app-plugin-page-bottom-nav .netease-shell {
  height: min(840px, calc(100% + 72px));
  margin-bottom: -72px;
  padding-bottom: 88px;
}
.nm-topbar,
.nm-main-grid,
.nm-main-surface,
.nm-player-bar,
.nm-expanded-content {
  position: relative;
  z-index: 1;
}
.nm-page-backdrop,
.nm-topbar,
.nm-main-grid,
.nm-main-surface,
.nm-player-bar {
  transition: filter 260ms var(--nm-ease), opacity 260ms var(--nm-ease);
}
.nm-expanded-active > .nm-page-backdrop,
.nm-expanded-active > .nm-topbar,
.nm-expanded-active > .nm-main-grid,
.nm-expanded-active > .nm-main-surface,
.nm-expanded-active > .nm-player-bar {
  filter: blur(14px) saturate(110%);
}
.nm-expanded-active > .nm-topbar,
.nm-expanded-active > .nm-main-grid,
.nm-expanded-active > .nm-main-surface,
.nm-expanded-active > .nm-player-bar {
  opacity: 0.78;
}
.nm-topbar {
  z-index: 20;
  min-height: 58px;
  display: grid;
  grid-template-columns: max-content max-content minmax(260px, 1fr);
  align-items: center;
  gap: 16px;
  animation: nmSlideIn 340ms var(--nm-spring) 40ms backwards;
}
.nm-brand {
  width: 190px;
  min-width: 190px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.nm-brand > span:last-child {
  min-width: 0;
}
.nm-brand strong {
  display: block;
  max-width: 124px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  line-height: 1.15;
}
.nm-top-nav {
  min-width: max-content;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 54%, transparent);
  backdrop-filter: blur(16px) saturate(124%);
  -webkit-backdrop-filter: blur(16px) saturate(124%);
  overflow-x: auto;
}
.nm-top-nav-button {
  min-height: 32px;
  padding: 0 10px !important;
  gap: 5px;
  white-space: nowrap;
  font-size: 12px !important;
  transition: transform 160ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-top-nav-button:hover {
  transform: translateY(-1px);
}
.nm-topbar-right {
  min-width: 0;
  width: 100%;
  max-width: 230px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: center;
  justify-self: end;
}
.nm-top-search {
  position: relative;
  min-width: 0;
  width: 100%;
  padding: 6px;
  animation-delay: 80ms;
}
.nm-search-suggest {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 200;
  width: 100%;
  padding: 7px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 42px rgba(0, 0, 0, 0.24);
  display: grid;
  gap: 4px;
  animation: nmContextIn 140ms var(--nm-spring) both;
}
.dark .nm-search-suggest {
  background: #171b24;
}
.nm-search-suggest-head {
  min-width: 0;
  padding: 2px 4px 4px 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.nm-search-suggest-title {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-search-clear-history {
  padding: 0;
  border: 0;
  background: transparent;
  color: color-mix(in srgb, var(--nm-accent) 82%, var(--nm-text));
  font-size: 11px;
  cursor: pointer;
}
.nm-search-clear-history:hover {
  text-decoration: underline;
}
.nm-search-suggest-empty {
  min-height: 30px;
  padding: 0 8px;
  color: var(--nm-muted);
  display: inline-flex;
  align-items: center;
  font-size: 12px;
}
.nm-search-suggest-item {
  width: 100%;
  min-height: 32px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 7px;
  text-align: left;
  cursor: pointer;
  transition: background 140ms var(--nm-ease), transform 140ms var(--nm-spring);
}
.nm-search-suggest-item:hover {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  transform: translateX(2px);
}
.nm-search-suggest-item span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.nm-search-suggest-item small {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-mark,
.nm-empty-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 92%, white), color-mix(in srgb, var(--nm-accent) 62%, #111827));
  color: white;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--nm-accent) 30%, transparent);
  flex: 0 0 auto;
  transition: transform 180ms var(--nm-ease), box-shadow 220ms var(--nm-ease);
}
.nm-brand:hover .nm-mark,
.nm-empty:hover .nm-empty-icon {
  transform: translateY(-1px) scale(1.03);
  box-shadow: 0 14px 30px color-mix(in srgb, var(--nm-accent) 34%, transparent);
}
.nm-kicker {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 11px;
  line-height: 1.2;
  text-transform: uppercase;
}
.nm-account-panel {
  width: max-content;
  max-width: 224px;
  min-width: 0;
  justify-self: end;
  padding: 7px 8px;
  display: grid;
  grid-template-columns: 36px minmax(74px, max-content) 30px;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 72%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
  animation: nmFadeIn 300ms var(--nm-ease) 90ms both;
}
.nm-topbar > .nm-account-panel {
  justify-self: start;
}
.nm-account-panel:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--nm-accent) 28%, var(--nm-soft-border));
}
.nm-account-logout {
  width: 30px;
  height: 30px;
  min-width: 30px;
  padding: 0 !important;
  justify-self: end;
}
.nm-account-copy,
.nm-head-copy,
.nm-row-copy,
.nm-now-brief > span {
  min-width: 0;
}
.nm-account-copy {
  max-width: 112px;
}
.nm-head-actions {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}
.nm-head-title-row {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.nm-title-count {
  flex: 0 0 auto;
}
.nm-head-left {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.nm-charts-head .nm-head-actions {
  margin-right: 20px;
}
.nm-account-copy strong,
.nm-title,
.nm-now-brief strong,
.nm-player-main strong {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 760;
}
.nm-account-copy small,
.nm-sub,
.nm-duration,
.nm-count,
.nm-now-brief small,
.nm-player-main small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-avatar,
.nm-row-cover,
.nm-mini-cover {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 24%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 18%, var(--muted, #323744)));
  color: color-mix(in srgb, var(--nm-accent) 64%, white);
  flex: 0 0 auto;
  transition: transform 220ms var(--nm-spring), box-shadow 220ms var(--nm-ease), filter 220ms var(--nm-ease);
}
.nm-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
}
.nm-icon-button,
.nm-search-button,
.nm-control-button,
.nm-mode-button,
.nm-settings-button {
  width: 34px;
  height: 34px;
  padding: 0 !important;
}
.nm-main-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(340px, 1fr) minmax(340px, 1fr);
  gap: 14px;
}
.nm-main-surface {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  animation: nmCardIn 360ms var(--nm-spring) 90ms backwards;
}
.nm-discovery-column {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
}
.nm-card,
.nm-player-bar,
.nm-empty {
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: var(--nm-card);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 44px rgba(0, 0, 0, 0.16);
  transition: border-color 220ms var(--nm-ease), background 260ms var(--nm-ease), box-shadow 260ms var(--nm-ease), transform 220ms var(--nm-ease);
}
.nm-card {
  min-width: 0;
  min-height: 0;
  padding: 12px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 10px;
  overflow: hidden;
  animation: nmCardIn 360ms var(--nm-spring) backwards;
}
.nm-page-card {
  width: 100%;
  height: 100%;
  grid-template-rows: auto minmax(0, 1fr);
}
.nm-list-page {
  max-width: 1120px;
  margin: 0 auto;
}
.nm-home-stack {
  width: min(1120px, 100%);
  height: 100%;
  margin: 0 auto;
  padding: 10px 14px 16px 12px;
  overflow: auto;
  scroll-padding-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.nm-home-hero {
  flex: 0 0 auto;
  min-height: 132px;
  padding: 20px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 20%, var(--nm-elevated)), color-mix(in srgb, #5ed9c8 10%, var(--nm-card)) 48%, color-mix(in srgb, var(--nm-card-solid) 74%, transparent));
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 18px;
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 44px rgba(0, 0, 0, 0.14);
}
.nm-home-hero-copy {
  min-width: 0;
}
.nm-home-hero-copy strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(24px, 3vw, 38px);
  line-height: 1.08;
}
.nm-home-hero-copy > span:last-child {
  display: block;
  margin-top: 8px;
  color: var(--nm-muted);
  font-size: 13px;
}
.nm-home-hero-actions {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.nm-home-section {
  flex: 0 0 auto;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 62%, transparent);
  backdrop-filter: blur(16px) saturate(124%);
  -webkit-backdrop-filter: blur(16px) saturate(124%);
  display: grid;
  gap: 10px;
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
}
.nm-home-section:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--nm-accent) 24%, var(--nm-soft-border));
}
.nm-discover-title {
  flex: 0 0 auto;
  min-width: 0;
  padding: 2px 2px 0;
  animation: nmFadeUp 280ms var(--nm-spring) 40ms both;
}
.nm-discover-title strong {
  display: block;
  font-size: 20px;
  line-height: 1.15;
}
.nm-discover-list-search {
  width: min(310px, calc(100vw - 96px));
  grid-template-columns: minmax(0, 230px) auto auto;
  justify-self: end;
}
.nm-discover-stack .nm-home-section {
  animation: nmCardIn 340ms var(--nm-spring) both;
}
.nm-discover-stack .nm-home-section:nth-of-type(1) {
  animation-delay: 80ms;
}
.nm-discover-stack .nm-home-section:nth-of-type(2) {
  animation-delay: 130ms;
}
.nm-discover-stack .nm-home-section:nth-of-type(3) {
  animation-delay: 180ms;
}
.nm-home-section-head {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.nm-home-section-head strong {
  display: block;
  font-size: 15px;
}
.nm-cover-strip {
  min-width: 0;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(132px, 148px);
  gap: 10px;
  overflow-x: auto;
  padding: 1px 2px 5px;
}
.nm-cover-card {
  min-width: 0;
  padding: 7px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 6px;
  transition: background 180ms var(--nm-ease), border-color 180ms var(--nm-ease), transform 180ms var(--nm-spring), box-shadow 220ms var(--nm-ease);
}
.nm-cover-card:hover,
.nm-cover-card-active {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--nm-accent) 30%, transparent);
}
.nm-cover-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
}
.nm-cover-card-image {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 22%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 16%, var(--muted, #323744)));
}
.nm-cover-card strong,
.nm-cover-card small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-cover-card strong {
  font-size: 12px;
  line-height: 1.25;
}
.nm-cover-card small {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-song-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 10px;
}
.nm-song-tile {
  min-width: 0;
  min-height: 50px;
  padding: 6px 7px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  transition: background 180ms var(--nm-ease), border-color 180ms var(--nm-ease), transform 180ms var(--nm-spring);
}
.nm-song-tile:hover,
.nm-song-tile-active {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--nm-accent) 30%, transparent);
}
.nm-song-tile:hover {
  transform: translateX(2px);
}
.nm-song-tile-cover {
  width: 38px;
  height: 38px;
  border-radius: 7px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 24%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 18%, var(--muted, #323744)));
}
.nm-song-tile-copy {
  min-width: 0;
}
.nm-song-tile-copy strong,
.nm-song-tile-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-song-tile-copy strong {
  font-size: 12px;
}
.nm-song-tile-copy small,
.nm-song-tile-duration {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-song-tile-duration {
  font-variant-numeric: tabular-nums;
}
.nm-home-empty {
  min-height: 52px;
  padding: 14px;
  border: 1px dashed var(--nm-soft-border);
  border-radius: 8px;
  color: var(--nm-muted);
  display: flex;
  align-items: center;
  font-size: 12px;
}
.nm-detail-page {
  gap: 12px;
}
.nm-detail-head {
  min-width: 0;
  min-height: 86px;
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
}
.nm-detail-cover {
  width: 74px;
  height: 74px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 22%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 16%, var(--muted, #323744)));
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
}
.nm-detail-copy {
  min-width: 0;
}
.nm-detail-copy strong,
.nm-detail-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-detail-copy strong {
  margin-top: 3px;
  font-size: 22px;
}
.nm-detail-copy small {
  margin-top: 6px;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-media-detail-page {
  grid-template-rows: auto minmax(0, 1fr);
}
.nm-media-detail-body {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
}
.nm-media-detail-head {
  min-width: 0;
  min-height: 86px;
  padding: 0;
  display: grid;
  grid-template-columns: auto 74px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  overflow: hidden;
  animation: nmFadeIn 260ms var(--nm-ease) backwards;
}
.nm-media-back {
  align-self: center;
}
.nm-media-detail-cover {
  width: 74px;
  height: 74px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--nm-accent) 22%, var(--muted, #323744)), color-mix(in srgb, #5ed9c8 16%, var(--muted, #323744)));
  color: color-mix(in srgb, var(--nm-accent) 64%, white);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18);
}
.nm-media-detail-copy {
  min-width: 0;
  display: block;
}
.nm-media-detail-copy strong {
  display: block;
  margin-top: 3px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 22px;
  font-weight: 820;
}
.nm-media-meta-row {
  margin-top: 5px;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.nm-media-detail-copy .nm-media-meta-row > small {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-media-tabs {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nm-media-tab {
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--nm-elevated) 72%, transparent);
  color: inherit;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  font-size: 11px;
  font-weight: 760;
  transition: background 160ms var(--nm-ease), border-color 160ms var(--nm-ease), color 160ms var(--nm-ease), transform 160ms var(--nm-spring);
}
.nm-media-tab:hover {
  transform: translateY(-1px);
}
.nm-media-tab small {
  color: var(--nm-muted);
  font-size: 10px;
  font-weight: 800;
}
.nm-media-tab-active {
  border-color: color-mix(in srgb, var(--nm-accent) 42%, var(--nm-soft-border));
  background: color-mix(in srgb, var(--nm-accent) 16%, transparent);
  color: color-mix(in srgb, var(--nm-accent) 86%, var(--nm-text));
}
.nm-media-tab-active small {
  color: currentColor;
}
.nm-media-detail-actions {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.nm-media-detail-actions {
  justify-self: end;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.nm-related-strip {
  min-width: 0;
  min-height: 34px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  animation: nmFadeIn 220ms var(--nm-ease) both;
}
.nm-related-title {
  color: var(--nm-muted);
  font-size: 12px;
  white-space: nowrap;
}
.nm-related-items {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.nm-related-chip {
  min-width: 0;
  max-width: 150px;
  height: 30px;
  padding: 0 8px 0 4px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
  color: inherit;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: background 160ms var(--nm-ease), border-color 160ms var(--nm-ease), transform 160ms var(--nm-spring);
}
.nm-related-chip:hover {
  border-color: color-mix(in srgb, var(--nm-accent) 34%, var(--nm-soft-border));
  background: color-mix(in srgb, var(--nm-accent) 10%, transparent);
  transform: translateY(-1px);
}
.nm-related-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.nm-related-cover {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  object-fit: cover;
  flex: 0 0 auto;
}
.nm-library-card {
  animation-delay: 90ms;
}
.nm-discovery-card {
  animation-delay: 140ms;
}
.nm-card:hover {
  border-color: color-mix(in srgb, var(--nm-accent) 22%, var(--nm-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
    0 22px 52px rgba(0, 0, 0, 0.18);
}
.nm-card-head {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  animation: nmFadeIn 280ms var(--nm-ease) both;
}
.nm-card-head strong {
  display: block;
  max-width: min(360px, 48vw);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
}
.nm-searchbar {
  min-width: 0;
  padding: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 74%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  animation: nmSlideIn 320ms var(--nm-spring) 120ms backwards;
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
}
.nm-searchbar:focus-within,
.nm-playlist-search:focus-within {
  border-color: color-mix(in srgb, var(--nm-accent) 46%, var(--nm-soft-border));
  background: color-mix(in srgb, var(--nm-elevated) 78%, transparent);
  transform: translateY(-1px);
}
.nm-library-body {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}
.nm-library-body > .nm-scroll-list:only-child {
  grid-row: 1 / -1;
}
.nm-search-results {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 8px;
}
.nm-search-tabs {
  justify-self: start;
  max-width: 100%;
  overflow-x: auto;
}
.nm-search-tabs .nm-panel-tab small {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--nm-muted) 18%, transparent);
  color: currentColor;
  font-size: 10px;
  font-weight: 800;
}
.nm-playlist-search {
  min-width: 0;
  padding: 6px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 6px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
  animation: nmListIn 220ms var(--nm-spring) backwards;
  transition: border-color 180ms var(--nm-ease), background 220ms var(--nm-ease), transform 180ms var(--nm-ease);
}
.nm-scroll-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 2px;
  animation: nmListIn 260ms var(--nm-spring) backwards;
}
.nm-virtual-list {
  display: block;
}
.nm-virtual-item {
  margin-bottom: 5px;
}
.nm-virtual-spacer {
  pointer-events: none;
  animation: none !important;
}
.nm-list-footer {
  min-height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--nm-muted);
  font-size: 12px;
  animation: nmFadeIn 180ms var(--nm-ease) both;
}
.nm-playlist-row,
.nm-song-row {
  width: 100%;
  min-height: 58px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  display: grid;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  text-align: left;
  cursor: pointer;
  transform: translateZ(0);
  transition:
    background 180ms var(--nm-ease),
    border-color 180ms var(--nm-ease),
    box-shadow 220ms var(--nm-ease),
    transform 180ms var(--nm-spring),
    opacity 180ms var(--nm-ease);
}
.nm-scroll-list > * {
  animation: nmRowIn 260ms var(--nm-spring) backwards;
}
.nm-scroll-list > *:nth-child(1) { animation-delay: 20ms; }
.nm-scroll-list > *:nth-child(2) { animation-delay: 35ms; }
.nm-scroll-list > *:nth-child(3) { animation-delay: 50ms; }
.nm-scroll-list > *:nth-child(4) { animation-delay: 65ms; }
.nm-scroll-list > *:nth-child(5) { animation-delay: 80ms; }
.nm-scroll-list > *:nth-child(n + 6) { animation-delay: 95ms; }
.nm-virtual-list > * {
  animation: none;
}
.nm-playlist-row {
  grid-template-columns: 44px minmax(0, 1fr) auto;
}
.nm-song-row {
  grid-template-columns: 44px 28px minmax(0, 1fr) auto 34px;
}
.nm-song-row-compact {
  min-height: 54px;
}
.nm-row-cover {
  width: 44px;
  height: 44px;
  border-radius: 8px;
}
.nm-playlist-row:hover,
.nm-song-row:hover,
.nm-row-active {
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--nm-accent) 34%, transparent);
}
.nm-playlist-row:hover,
.nm-song-row:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.1);
}
.nm-playlist-row:hover .nm-row-cover,
.nm-song-row:hover .nm-row-cover {
  transform: scale(1.045);
  filter: saturate(108%);
}
.nm-playlist-row:active,
.nm-song-row:active {
  transform: translateY(0) scale(0.995);
}
.nm-row-active {
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--nm-accent) 86%, white);
}
.nm-row-active .nm-row-cover {
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--nm-accent) 52%, transparent);
}
.nm-skeleton-list {
  pointer-events: none;
}
.nm-skeleton-row {
  cursor: default;
}
.nm-skeleton-block,
.nm-skeleton-text,
.nm-skeleton-dot {
  position: relative;
  overflow: hidden;
  background: color-mix(in srgb, var(--nm-muted) 16%, transparent);
}
.nm-skeleton-block::after,
.nm-skeleton-text::after,
.nm-skeleton-dot::after {
  content: "";
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(90deg, transparent, color-mix(in srgb, white 18%, transparent), transparent);
  animation: nmSkeletonSweep 1.2s ease-in-out infinite;
}
.nm-skeleton-text {
  display: block;
  height: 10px;
  border-radius: 999px;
}
.nm-skeleton-title {
  width: min(72%, 240px);
  margin-bottom: 8px;
}
.nm-skeleton-sub {
  width: min(48%, 180px);
}
.nm-skeleton-short {
  width: 34px;
}
.nm-skeleton-dot {
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.nm-row-action {
  width: 30px;
  height: 30px;
  padding: 0 !important;
  justify-self: end;
  transition: color 160ms var(--nm-ease), transform 160ms var(--nm-spring), background 160ms var(--nm-ease);
}
.nm-row-action:hover,
.nm-settings-button:hover,
.nm-control-button:hover,
.nm-mode-button:hover {
  transform: translateY(-1px) scale(1.04);
}
.nm-row-action:active,
.nm-settings-button:active,
.nm-control-button:active,
.nm-mode-button:active,
.nm-play-button:active,
.nm-panel-tab:active {
  transform: scale(0.95);
}
.nm-like-active {
  color: #ff4f6d !important;
  animation: nmPop 240ms var(--nm-spring);
}
.nm-subscribe-active {
  color: color-mix(in srgb, var(--nm-accent) 88%, white) !important;
  animation: nmPop 240ms var(--nm-spring);
}
.nm-panel-tabs {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 54%, transparent);
  transition: background 180ms var(--nm-ease), border-color 180ms var(--nm-ease);
}
.nm-panel-tab {
  min-height: 28px;
  padding: 0 8px !important;
  gap: 5px;
  font-size: 12px !important;
  transition: transform 160ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-panel-tab:hover {
  transform: translateY(-1px);
}
.nm-library-tabs .nm-panel-tab {
  padding: 0 7px !important;
}
.nm-index {
  color: var(--nm-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.nm-empty {
  min-height: 180px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 9px;
  color: var(--nm-muted);
  font-size: 13px;
  animation: nmEmptyIn 320ms var(--nm-spring) both;
}
.nm-empty strong {
  color: var(--nm-text);
  font-size: 14px;
}
.nm-login-panel {
  align-self: center;
  justify-self: center;
  width: min(100%, 360px);
}
.nm-login-dialog {
  width: min(420px, calc(100vw - 96px)) !important;
  align-items: stretch !important;
}
.nm-login-dialog-qr {
  width: min(420px, calc(100vw - 96px)) !important;
}
.nm-login-dialog-phone {
  width: min(420px, calc(100vw - 96px)) !important;
}
.nm-login-dialog-body {
  width: 100%;
  min-width: 0;
  display: grid;
  gap: 12px;
  justify-items: center;
}
.nm-login-tabs {
  width: min(252px, 100%);
  min-width: 0;
  justify-self: center;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 3px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
}
.nm-login-tab {
  width: 100%;
  min-height: 32px;
  gap: 6px;
  padding: 0 8px !important;
  font-size: 12px !important;
  transition: transform 160ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-login-tab:hover {
  transform: translateY(-1px);
}
.nm-qr-panel,
.nm-phone-panel {
  min-width: 0;
  display: grid;
  gap: 10px;
  justify-items: center;
  animation: nmFadeUp 260ms var(--nm-spring) both;
}
.nm-qr-image {
  width: 188px;
  height: 188px;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 24%, var(--nm-soft-border));
  border-radius: 8px;
  background: color-mix(in srgb, white 88%, var(--nm-accent) 8%);
  color: color-mix(in srgb, var(--nm-accent) 68%, #111827);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.72),
    0 10px 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
  transition: border-color 180ms var(--nm-ease), transform 180ms var(--nm-spring), opacity 180ms var(--nm-ease);
}
.nm-qr-image img {
  width: 168px;
  height: 168px;
  display: block;
  object-fit: contain;
}
.nm-qr-loading {
  opacity: 0.72;
}
.nm-login-status {
  min-height: 18px;
  color: var(--nm-muted);
  font-size: 12px;
  line-height: 1.45;
  text-align: center;
}
.nm-login-status-error {
  color: color-mix(in srgb, #ff4f6d 84%, var(--nm-text));
}
.nm-phone-panel {
  width: 100%;
  justify-items: stretch;
  gap: 14px;
}
.nm-phone-form {
  min-width: 0;
  width: max-content;
  justify-self: center;
  display: grid;
  grid-template-columns: 92px minmax(0, 150px);
  align-items: end;
  gap: 10px;
}
.nm-phone-captcha-form {
  grid-template-columns: 92px minmax(0, 150px);
}
.nm-phone-field {
  min-width: 0;
  display: grid;
  gap: 6px;
  color: var(--nm-muted);
  font-size: 11px;
  line-height: 1;
}
.nm-phone-field > span {
  padding-left: 2px;
  font-weight: 680;
}
.nm-phone-input {
  height: 38px !important;
  min-height: 38px !important;
  padding: 0 11px !important;
  border-radius: 8px !important;
  font-size: 13px !important;
  line-height: 38px !important;
}
.nm-phone-send {
  width: 100%;
  height: 38px;
  min-height: 38px;
  padding: 0 10px !important;
  border: 1px solid var(--nm-soft-border) !important;
  border-radius: 8px !important;
  white-space: nowrap;
}
.nm-phone-status {
  min-height: 32px;
  padding: 7px 10px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 54%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.nm-phone-submit {
  width: min(100%, 220px);
  height: 38px;
  min-height: 38px;
}
.nm-login-actions {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.nm-login-hint {
  max-width: 320px;
  color: color-mix(in srgb, var(--nm-muted) 86%, transparent);
  font-size: 11px;
  line-height: 1.45;
  text-align: center;
}
.nm-player-bar {
  min-width: 0;
  padding: 5px 10px 5px;
  position: relative;
  display: grid;
  grid-template-rows: auto auto;
  row-gap: 3px;
  cursor: pointer;
  animation: nmPlayerIn 380ms var(--nm-spring) 170ms backwards;
}
.nm-player-bar:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--nm-accent) 28%, var(--nm-border));
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 14%, transparent),
    0 22px 48px rgba(0, 0, 0, 0.2);
}
.nm-progress-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  align-items: center;
  gap: 4px;
}
.nm-progress {
  min-width: 0;
  height: 20px;
  display: flex;
  align-items: center;
}
.nm-time-label {
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--nm-muted);
  font-size: 11px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-align: center;
}
.nm-time-label:last-child {
  justify-content: center;
  text-align: center;
}
.nm-player-bar .nm-progress label,
.nm-player-bar .nm-volume label {
  --slider-height: 4px;
  width: 100%;
}
.nm-player-main {
  min-height: 38px;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(300px, 1fr);
  align-items: center;
  gap: 10px;
}
.nm-now-brief {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.nm-mini-cover {
  width: 34px;
  height: 34px;
  border-radius: 7px;
}
.nm-playing .nm-mini-cover {
  animation: nmMiniCoverPulse 2.8s ease-in-out infinite;
}
.nm-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
}
.nm-control-button {
  width: 30px;
  height: 30px;
}
.nm-player-bar .nm-mode-button {
  width: 30px;
  height: 30px;
}
.nm-play-button {
  width: 36px;
  height: 36px;
  padding: 0 !important;
  border-radius: 50%;
  box-shadow: 0 8px 18px color-mix(in srgb, var(--nm-accent) 28%, transparent);
  transition: transform 170ms var(--nm-spring), box-shadow 220ms var(--nm-ease), filter 180ms var(--nm-ease);
}
.nm-play-button:hover {
  transform: scale(1.06);
  filter: saturate(110%);
  box-shadow: 0 10px 22px color-mix(in srgb, var(--nm-accent) 36%, transparent);
}
.nm-mode-active {
  color: var(--nm-accent) !important;
}
.nm-player-tools {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  justify-self: end;
  width: auto;
}
.nm-settings-button {
  width: 30px;
  height: 30px;
  padding: 0 !important;
}
.nm-quality-group {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 4px;
  padding: 2px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
}
.nm-quality-button {
  width: 100%;
  min-height: 22px;
  padding: 2px 4px !important;
  font-size: 11px !important;
  line-height: 1.2;
  transition: transform 150ms var(--nm-spring), background 180ms var(--nm-ease), color 160ms var(--nm-ease);
}
.nm-quality-button:hover {
  transform: translateY(-1px);
}
.nm-volume {
  min-width: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  color: var(--nm-muted);
  width: 100px;
  flex: 0 0 100px;
}
.nm-volume-mute {
  width: 26px;
  height: 26px;
  padding: 0 !important;
  color: var(--nm-muted) !important;
}
.nm-volume-mute:hover {
  color: var(--nm-accent) !important;
}
.nm-queue-anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}
.nm-queue-button {
  color: var(--nm-muted) !important;
}
.nm-queue-popover {
  position: absolute;
  right: 0;
  bottom: calc(100% + 12px);
  z-index: 40;
  width: min(238px, calc(100vw - 44px));
  max-height: min(390px, calc(100vh - 210px));
  padding: 8px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 6px;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 22%, var(--nm-border));
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 22%, transparent),
    0 20px 54px rgba(0, 0, 0, 0.32);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transform-origin: right bottom;
  cursor: default;
  animation: nmQueueIn 180ms var(--nm-spring) both;
}
.dark .nm-queue-popover {
  background: #171b24;
}
.nm-queue-head {
  min-width: 0;
  min-height: 34px;
  padding: 2px 2px 4px 6px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
}
.nm-queue-head strong,
.nm-queue-head small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-queue-head strong {
  font-size: 13px;
}
.nm-queue-head small {
  margin-top: 2px;
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-queue-clear {
  width: 28px;
  height: 28px;
  padding: 0 !important;
}
.nm-queue-list {
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-right: 2px;
}
.nm-queue-row {
  width: 100%;
  min-height: 48px;
  padding: 6px 7px;
  border: 1px solid transparent;
  border-radius: 7px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px;
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 160ms var(--nm-ease), border-color 160ms var(--nm-ease), color 160ms var(--nm-ease), transform 160ms var(--nm-spring);
}
.nm-queue-row:hover,
.nm-queue-row-active {
  background: color-mix(in srgb, var(--nm-accent) 15%, var(--background, #f8fafc));
  border-color: color-mix(in srgb, var(--nm-accent) 28%, transparent);
}
.nm-queue-row:hover {
  transform: translateX(1px);
}
.nm-queue-row-active {
  color: color-mix(in srgb, var(--nm-accent) 84%, white);
}
.nm-queue-index {
  min-width: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
  font-size: 12px;
  font-weight: 780;
  font-variant-numeric: tabular-nums;
}
.nm-queue-copy {
  min-width: 0;
}
.nm-queue-copy strong,
.nm-queue-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-queue-copy strong {
  font-size: 13px;
  line-height: 1.25;
}
.nm-queue-copy small,
.nm-queue-duration {
  color: var(--nm-muted);
  font-size: 11px;
}
.nm-queue-copy small {
  margin-top: 3px;
}
.nm-queue-duration {
  font-variant-numeric: tabular-nums;
}
.nm-queue-empty {
  min-height: 120px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-floating-mini {
  position: absolute;
  right: 20px;
  bottom: 96px;
  z-index: 12;
  width: min(420px, calc(100% - 40px));
  min-height: 64px;
  padding: 9px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 26%, var(--nm-border));
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-card-solid) 92%, var(--background, #151820));
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 48px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(18px) saturate(132%);
  -webkit-backdrop-filter: blur(18px) saturate(132%);
  animation: nmMiniIn 220ms var(--nm-spring) both;
}
.nm-floating-mini-cover {
  width: 46px;
  height: 46px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
}
.nm-floating-mini-copy {
  min-width: 0;
}
.nm-floating-mini-copy strong,
.nm-floating-mini-copy small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.nm-floating-mini-copy strong {
  font-size: 13px;
}
.nm-floating-mini-copy small {
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-floating-mini-controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.nm-floating-mini-play {
  width: 32px;
  height: 32px;
  padding: 0 !important;
  border-radius: 50%;
}
.nm-settings-card {
  width: min(560px, calc(100vw - 96px)) !important;
  max-height: calc(100vh - 96px);
  align-items: stretch !important;
}
.nm-settings-dialog {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}
.nm-settings-section {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.nm-settings-row {
  min-width: 0;
  padding: 8px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: center;
  gap: 12px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
}
.nm-settings-copy {
  min-width: 0;
}
.nm-settings-copy strong,
.nm-settings-copy small {
  display: block;
  min-width: 0;
}
.nm-settings-copy strong {
  font-size: 13px;
}
.nm-settings-copy small {
  margin-top: 3px;
  color: var(--muted-foreground, #a8adbd);
  font-size: 12px;
}
.nm-toggle-button {
  min-width: 58px;
  justify-self: end;
}
.nm-dialog-label {
  color: var(--muted-foreground, #a8adbd);
  font-size: 12px;
}
.nm-settings-dialog .nm-quality-group {
  width: 100%;
}
.nm-settings-dialog .nm-quality-button {
  min-height: 30px;
}
.nm-cache-panel {
  min-width: 0;
  padding: 8px;
  display: grid;
  gap: 8px;
  border: 1px solid var(--nm-soft-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--nm-elevated) 58%, transparent);
  color: var(--nm-muted);
  font-size: 12px;
}
.nm-cache-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.nm-cache-button {
  min-height: 28px;
}
.nm-expanded-player {
  position: absolute;
  inset: 0;
  z-index: 9999;
  background-color: rgba(255, 255, 255, 0.24);
  background-color: color-mix(in srgb, var(--background, #151820) 28%, transparent);
  background-image: none;
  background-position: center;
  background-size: cover;
  border-radius: 8px;
  overflow: hidden;
  backdrop-filter: blur(26px) saturate(132%);
  -webkit-backdrop-filter: blur(26px) saturate(132%);
  animation: nmExpandIn 280ms var(--nm-spring);
}
.nm-expanded-closing {
  pointer-events: none;
  animation: nmExpandOut 240ms var(--nm-ease) both;
}
.nm-expanded-overlay {
  position: absolute;
  inset: 0;
  z-index: 0;
  background:
    radial-gradient(circle at 20% 18%, color-mix(in srgb, var(--nm-accent) 20%, transparent), transparent 36%),
    linear-gradient(120deg, color-mix(in srgb, var(--background, #151820) 72%, transparent), color-mix(in srgb, var(--card, #272b36) 30%, transparent) 48%, color-mix(in srgb, var(--background, #151820) 74%, transparent)),
    linear-gradient(0deg, color-mix(in srgb, var(--background, #151820) 58%, transparent), transparent 48%, color-mix(in srgb, var(--background, #151820) 46%, transparent));
  backdrop-filter: blur(26px) saturate(132%);
  -webkit-backdrop-filter: blur(26px) saturate(132%);
  animation: nmFadeIn 320ms var(--nm-ease) both;
}
.nm-expanded-closing .nm-expanded-overlay {
  animation: nmFadeOut 220ms var(--nm-ease) both;
}
.nm-expanded-content {
  height: 100%;
  padding: 16px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  animation: nmExpandedContentIn 360ms var(--nm-spring) 80ms both;
}
.nm-expanded-closing .nm-expanded-content {
  animation: nmExpandedContentOut 190ms var(--nm-ease) both;
}
.nm-expanded-top {
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.nm-lyrics-tools {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.nm-lyric-size-button {
  width: 28px;
  height: 28px;
  padding: 0 !important;
  font-size: 11px !important;
}
.nm-expanded-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 0.95fr) minmax(360px, 1.05fr);
  gap: 18px;
}
.nm-cover-stage,
.nm-lyrics-panel {
  min-width: 0;
  min-height: 0;
}
.nm-cover-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
}
.nm-cover-wrap {
  position: relative;
  width: min(82%, 390px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
}
.nm-vinyl {
  position: absolute;
  inset: 10%;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, #111 0 10%, #2b2d33 10% 13%, #0b0c10 13% 34%, #262932 34% 35%, #090a0d 35% 100%),
    conic-gradient(from 0deg, rgba(255,255,255,0.06), transparent 18%, rgba(255,255,255,0.05) 32%, transparent 58%, rgba(255,255,255,0.04) 76%, transparent);
  transform: translateX(18%);
  opacity: 0.78;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.44);
  transition: opacity 240ms var(--nm-ease), transform 260ms var(--nm-spring);
}
.nm-vinyl-playing {
  animation: nmSpin 12s linear infinite;
}
@keyframes nmSpin {
  to { transform: translateX(18%) rotate(360deg); }
}
.nm-cover-frame {
  position: relative;
  width: 82%;
  z-index: 1;
  animation: nmCoverIn 420ms var(--nm-spring) both;
}
.nm-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  background: color-mix(in srgb, var(--muted, #323744) 78%, transparent);
  box-shadow:
    0 24px 60px rgba(0, 0, 0, 0.42),
    0 0 0 1px color-mix(in srgb, white 16%, transparent);
  transition: transform 260ms var(--nm-spring), box-shadow 260ms var(--nm-ease), filter 260ms var(--nm-ease);
}
.nm-cover-stage:hover .nm-cover {
  transform: translateY(-2px) scale(1.012);
  filter: saturate(108%);
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.46),
    0 0 0 1px color-mix(in srgb, white 20%, transparent);
}
.nm-cover-empty {
  color: color-mix(in srgb, var(--nm-accent) 58%, white);
}
.nm-badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--nm-accent) 82%, #111827);
  color: white;
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 800;
  animation: nmBadgeIn 260ms var(--nm-spring) both;
}
.nm-track-meta {
  width: 100%;
  min-width: 0;
  text-align: center;
  animation: nmFadeUp 340ms var(--nm-spring) 120ms both;
}
.nm-track-meta strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: clamp(26px, 3.2vw, 42px);
  line-height: 1.08;
}
.nm-track-meta > span {
  display: block;
  margin-top: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--nm-muted);
  font-size: 14px;
}
.nm-lyrics-panel {
  overflow: auto;
  padding: 40px 10px;
  mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 14%, black 86%, transparent 100%);
}
.nm-lyric-line {
  padding: 9px 12px;
  border-radius: 8px;
  color: color-mix(in srgb, var(--nm-muted) 88%, white);
  font-size: 14px;
  line-height: 1.48;
  text-align: center;
  cursor: pointer;
  transition: color 0.24s ease, background 0.24s ease, transform 0.24s ease, opacity 0.24s ease;
  opacity: 0.68;
}
.nm-lyrics-compact .nm-lyric-line {
  font-size: 12px;
}
.nm-lyrics-large .nm-lyric-line {
  font-size: 16px;
}
.nm-lyric-line small {
  display: block;
  margin-top: 4px;
  color: color-mix(in srgb, var(--nm-muted) 76%, transparent);
  font-size: 12px;
}
.nm-lyrics-compact .nm-lyric-line small {
  font-size: 11px;
}
.nm-lyrics-large .nm-lyric-line small {
  font-size: 13px;
}
.nm-lyric-active {
  color: var(--nm-text);
  background: color-mix(in srgb, var(--nm-accent) 15%, transparent);
  font-size: 18px;
  font-weight: 820;
  opacity: 1;
  transform: scale(1.02);
}
.nm-lyric-status {
  min-height: 100%;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--nm-muted);
  animation: nmFadeUp 280ms var(--nm-spring) both;
}
.nm-lyric-status-icon {
  width: 52px;
  height: 52px;
  margin-bottom: 12px;
  border: 1px solid color-mix(in srgb, var(--nm-accent) 24%, var(--nm-soft-border));
  border-radius: 50%;
  background: color-mix(in srgb, var(--nm-accent) 12%, transparent);
  color: color-mix(in srgb, var(--nm-accent) 78%, white);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.nm-lyric-status strong {
  color: var(--nm-text);
  font-size: 20px;
}
.nm-lyric-status small {
  max-width: 280px;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
}
.nm-lyric-status-loading .nm-lyric-status-icon {
  animation: nmSpin 1.2s linear infinite;
}
.nm-lyrics-compact .nm-lyric-active {
  font-size: 15px;
}
.nm-lyrics-large .nm-lyric-active {
  font-size: 22px;
}
.nm-cover-fallback {
  border: 1px solid color-mix(in srgb, white 10%, transparent);
}
.nm-context-menu {
  position: absolute;
  z-index: 30;
  min-width: 154px;
  padding: 5px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 46px rgba(0, 0, 0, 0.28);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  animation: nmContextIn 140ms var(--nm-spring) both;
}
.dark .nm-context-menu {
  background: #171b24;
}
.nm-context-item {
  width: 100%;
  min-height: 30px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  display: flex;
  align-items: center;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
  transition: background 140ms var(--nm-ease), color 140ms var(--nm-ease), transform 140ms var(--nm-spring);
}
.nm-context-item:hover {
  background: color-mix(in srgb, var(--nm-accent) 14%, transparent);
  color: color-mix(in srgb, var(--nm-accent) 84%, white);
  transform: translateX(1px);
}
.nm-context-submenu {
  position: relative;
  display: block;
}
.nm-context-submenu::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 100%;
  width: 10px;
}
.nm-context-submenu-trigger svg:last-child {
  margin-left: auto;
}
.nm-context-submenu-panel {
  position: absolute;
  top: -5px;
  left: calc(100% + 2px);
  z-index: 31;
  min-width: 142px;
  max-width: 210px;
  padding: 5px;
  border: 1px solid var(--nm-border);
  border-radius: 8px;
  background: #f8fafc;
  color: var(--nm-text);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 12%, transparent),
    0 18px 46px rgba(0, 0, 0, 0.28);
  opacity: 0;
  pointer-events: none;
  transform: translateX(-4px) scale(0.98);
  transform-origin: left top;
  transition: opacity 120ms var(--nm-ease), transform 140ms var(--nm-spring);
}
.dark .nm-context-submenu-panel {
  background: #171b24;
}
.nm-context-submenu:hover .nm-context-submenu-panel,
.nm-context-submenu:focus-within .nm-context-submenu-panel {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0) scale(1);
}
.netease-shell ::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.netease-shell ::-webkit-scrollbar-track {
  background: transparent;
}
.netease-shell ::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--nm-accent) 54%, #5ed9c8);
  border-radius: 999px;
}
@keyframes nmShellIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes nmSlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmCardIn {
  from {
    opacity: 0;
    transform: translateY(12px) scale(0.992);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmListIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmRowIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmPlayerIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmExpandIn {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmExpandOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(18px);
  }
}
@keyframes nmExpandedContentIn {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmExpandedContentOut {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(12px);
  }
}
@keyframes nmCoverIn {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.96) rotate(-1deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1) rotate(0deg);
  }
}
@keyframes nmFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes nmFadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes nmFadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes nmEmptyIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.99);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmPop {
  0% { transform: scale(0.88); }
  65% { transform: scale(1.12); }
  100% { transform: scale(1); }
}
@keyframes nmMiniCoverPulse {
  0%, 100% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--nm-accent) 0%, transparent);
  }
  50% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--nm-accent) 18%, transparent);
  }
}
@keyframes nmBadgeIn {
  from {
    opacity: 0;
    transform: translateY(6px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmContextIn {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmMiniIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmQueueIn {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
@keyframes nmSkeletonSweep {
  to {
    transform: translateX(100%);
  }
}
@keyframes nmBackdropDrift {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.025);
  }
}
@media (max-width: 1040px) {
  .netease-shell {
    height: auto;
    min-height: 720px;
  }
  .nm-topbar {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
  .nm-brand,
  .nm-top-nav,
  .nm-topbar-right {
    justify-self: stretch;
  }
  .nm-top-nav {
    width: 100%;
    min-width: 0;
    max-width: 100%;
  }
  .nm-topbar-right {
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    padding-right: 0;
  }
  .nm-main-grid,
  .nm-expanded-grid {
    grid-template-columns: 1fr;
  }
  .nm-home-hero {
    grid-template-columns: 1fr;
    align-items: start;
  }
  .nm-home-hero-actions {
    justify-content: flex-start;
  }
  .nm-player-main {
    grid-template-columns: 1fr;
  }
  .nm-player-tools {
    justify-self: stretch;
    width: 100%;
    flex-wrap: wrap;
  }
  .nm-queue-popover {
    right: 0;
  }
}
@media (max-width: 700px) {
  .nm-login-dialog {
    width: calc(100vw - 32px) !important;
    padding: 22px !important;
  }
  .nm-phone-form,
  .nm-phone-captcha-form {
    grid-template-columns: 1fr;
  }
  .nm-settings-card {
    width: calc(100vw - 32px) !important;
    padding: 22px !important;
  }
  .nm-settings-row {
    grid-template-columns: 1fr;
  }
  .nm-toggle-button {
    justify-self: start;
  }
  .nm-settings-dialog .nm-quality-group {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .netease-shell {
    padding: 12px;
  }
  .nm-topbar {
    gap: 10px;
  }
  .nm-topbar-right {
    min-width: 0;
    grid-template-columns: 1fr;
    padding-right: 0;
  }
  .nm-top-nav {
    justify-content: flex-start;
  }
  .nm-account-panel {
    width: 100%;
    max-width: none;
  }
  .nm-song-strip {
    grid-template-columns: 1fr;
  }
  .nm-detail-head {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .nm-detail-cover {
    display: none;
  }
  .nm-media-detail-head {
    grid-template-columns: auto 72px minmax(0, 1fr);
    align-items: start;
  }
  .nm-media-detail-cover {
    width: 72px;
    height: 72px;
  }
  .nm-media-detail-copy strong {
    font-size: 18px;
  }
  .nm-media-detail-actions {
    grid-column: 2 / -1;
    justify-self: start;
  }
  .nm-song-row {
    grid-template-columns: 40px minmax(0, 1fr) auto 34px;
  }
  .nm-song-row .nm-index {
    display: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .netease-shell,
  .netease-shell *,
  .netease-shell *::before,
  .netease-shell *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
  .nm-page-backdrop,
  .nm-vinyl-playing,
  .nm-playing .nm-mini-cover {
    animation: none !important;
  }
}
`;
