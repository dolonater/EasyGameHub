import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import type { TFunction } from "i18next";
import GlassCard from "../ui/GlassCard";
import AsciiLogo from "../AsciiLogo";

// ── Props ─────────────────────────────────────────────────────────

interface SettingsAboutSectionProps {
  t: TFunction;
}

// ── Component ─────────────────────────────────────────────────────

export default function SettingsAboutSection({ t }: SettingsAboutSectionProps) {
  const [updateMsg, setUpdateMsg] = useState("");
  const [dbUpdateMsg, setDbUpdateMsg] = useState("");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "done">("idle");
  const [dbStatus, setDbStatus] = useState<"idle" | "checking" | "done">("idle");

  const handleCheckUpdate = async () => {
    setUpdateStatus("checking"); setUpdateMsg("");
    try {
      const r = await check();
      setUpdateMsg(r?.available ? t("about.newVersion", { version: r.version }) : t("about.upToDate"));
    } catch { setUpdateMsg(t("about.checkFailed")); }
    setUpdateStatus("done");
  };

  const handleCheckDbUpdate = async () => {
    setDbStatus("checking"); setDbUpdateMsg("");
    try {
      const info: any = await invoke("check_db_update");
      setDbUpdateMsg(info?.has_update ? t("about.dbNewVersion", { version: info.latest_version }) : t("about.dbUpToDate"));
    } catch { setDbUpdateMsg(t("about.dbCheckFailed")); }
    setDbStatus("done");
  };

  return (
    <div className="space-y-5">
      {/* ── Terminal window ─────────────────────────────────── */}
      <GlassCard className="overflow-hidden rounded-xl">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-secondary/40 border-b border-border/40 select-none">
          <span className="text-[11px] text-muted-foreground font-mono">about.sh</span>
        </div>

        {/* Terminal body */}
        <div className="p-4 sm:p-5 font-mono text-sm space-y-1 text-foreground/90">

          {/* neofetch: logo + info */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
            <AsciiLogo className="hidden sm:block text-[10px] sm:text-[11px] shrink-0" shadow />
            <div className="space-y-0.5 text-xs min-w-0">
              {[
                ["   app", t("about.appName")],
                ["  desc", t("about.appDesc")],
                ["   ver", "v0.1.0"],
                ["  deps", "Tauri v2 / React 18 / Rust"],
                ["    db", "Ludusavi Manifest (CC0)"],
                ["  arch", "x86_64-pc-windows-msvc"],
              ].map(([label, value]) => (
                <div key={label} className="flex">
                  <span className="text-primary font-bold shrink-0 w-[7ch] text-right">{label}</span>
                  <span className="text-muted-foreground ml-2">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className="text-muted-foreground/25 select-none pt-1">
            {"─".repeat(48)}
          </div>

          {/* Commands */}
          <div className="space-y-1 text-xs">
            {/* check-app-update */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-green-400 select-none">$</span>
                <button onClick={handleCheckUpdate} className="hover:text-primary transition-colors text-left">
                  check-app-update
                  {updateStatus === "checking" && <span className="text-muted-foreground ml-1">{t("about.checking")}</span>}
                </button>
              </div>
              {updateMsg && updateStatus === "done" && (
                <div className="ml-5 text-muted-foreground">└─ {updateMsg}</div>
              )}
            </div>

            {/* check-db-update */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-green-400 select-none">$</span>
                <button onClick={handleCheckDbUpdate} className="hover:text-primary transition-colors text-left">
                  check-db-update
                  {dbStatus === "checking" && <span className="text-muted-foreground ml-1">{t("about.checking")}</span>}
                </button>
              </div>
              {dbUpdateMsg && dbStatus === "done" && (
                <div className="ml-5 text-muted-foreground">└─ {dbUpdateMsg}</div>
              )}
            </div>

            {/* open-github */}
            <div className="flex items-center gap-1.5">
              <span className="text-green-400 select-none">$</span>
              <a
                href="https://github.com/doona/gamesave-backup"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary transition-colors"
              >
                open-github
              </a>
              <span className="text-muted-foreground">→</span>
            </div>
          </div>

          {/* Credits as comments */}
          <div className="text-[10px] text-muted-foreground/50 space-y-0.5 select-none pt-1">
            <div># {t("about.creditsDb")}</div>
            <div># {t("about.creditsTech")}</div>
          </div>

          {/* Blinking cursor */}
          <div className="flex items-center gap-1.5 text-xs pt-1">
            <span className="text-green-400">$</span>
            <span className="inline-block w-2.5 h-[1.1em] bg-primary/70 animate-pulse" />
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
