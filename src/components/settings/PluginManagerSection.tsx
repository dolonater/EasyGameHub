import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { TFunction } from "i18next";
import { createElement } from "react";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import GlassCard from "../ui/GlassCard";
import Icon from "../ui/Icon";
import Toggle from "../ui/Toggle";
import { usePlugins } from "../../plugins/PluginProvider";
import PluginErrorBoundary from "../../plugins/ErrorBoundary";
import type { PluginRecord } from "../../plugins/types";
import { ICONS, type IconName } from "../../lib/icons";
import { showToast } from "../../lib/toast";

interface PluginManagerSectionProps {
  t: TFunction;
}

/** Render a plugin's manifest icon: `assets/...` resolves to an image via the
 *  asset protocol, any other value is treated as an app Icon name; unknown or
 *  missing icons fall back to a generic placeholder. */
function PluginIcon({ record, pluginsDir }: { record: PluginRecord; pluginsDir: string }) {
  const icon = record.icon;
  if (icon && icon.startsWith("assets/")) {
    const url = convertFileSrc(`${pluginsDir.replace(/\\/g, "/")}/${record.id}/${icon}`);
    return <img src={url} alt="" className="h-5 w-5 object-contain" draggable={false} />;
  }
  if (icon && icon in ICONS) {
    return <Icon name={icon as IconName} size={20} />;
  }
  return <Icon name="grid" size={20} />;
}

export default function PluginManagerSection({ t }: PluginManagerSectionProps) {
  const { records, pluginsDir, pages, settingsSections, install, reload, uninstall, setEnabled } = usePlugins();
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Drag-drop install. The listener is only mounted while this section is on
  // screen (settings → 插件 tab), so dropping a zip only works on the plugin
  // page. Position gating is deliberately avoided: Tauri reports an inaccurate
  // drop position while the devtools panel is open, so any drop on the plugin
  // page is accepted (the overlay covers the whole window as a hint).
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (disposed) return;
          const e = event.payload;
          if (e.type === "enter" || e.type === "over") {
            setDragActive(true);
          } else if (e.type === "leave") {
            setDragActive(false);
          } else if (e.type === "drop") {
            setDragActive(false);
            const zipPath = e.paths.find((p) => p.toLowerCase().endsWith(".zip"));
            if (!zipPath) {
              showToast("error", t("plugins.dropNotZip", { defaultValue: "仅支持 .zip 插件包" }));
              return;
            }
            void install(zipPath);
          }
        });
      } catch (e) {
        console.error("[plugins] onDragDropEvent failed:", e);
      }
    })();
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [install, t]);

  const targetRecord = uninstallTarget
    ? records.find((r) => r.id === uninstallTarget)
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {t("plugins.title", { defaultValue: "插件" })}
          {records.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">
              {records.length} {t("plugins.count", { defaultValue: "个已安装" })}
            </span>
          )}
        </h2>
        <Button variant="primary" size="sm" onClick={() => void install()}>
          <Icon name="addGame" size={14} className="mr-1" />
          {t("plugins.install", { defaultValue: "安装插件" })}
        </Button>
      </div>

      {records.length === 0 && (
        <GlassCard className="p-6 text-center text-sm text-muted-foreground">
          {t("plugins.none", { defaultValue: "尚未安装任何插件" })}
          <div className="mt-1 text-xs opacity-80">
            {t("plugins.dragHint", { defaultValue: "也可以将插件 zip 包拖入本页安装" })}
          </div>
        </GlassCard>
      )}

      {records.map((record) => {
        const pageCount = pages.filter((p) => p.pluginId === record.id).length;
        const sectionCount = settingsSections.filter((s) => s.pluginId === record.id).length;
        return (
          <GlassCard key={record.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-muted-foreground">
                    <PluginIcon record={record} pluginsDir={pluginsDir} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{record.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">v{record.version}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        api v{record.api_version}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{record.id}</div>
                  </div>
                </div>
                {record.description && (
                  <p
                    className="mt-2 line-clamp-2 text-xs text-muted-foreground"
                    title={record.description}
                  >
                    {record.description}
                  </p>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {t("plugins.uiSummary", {
                    defaultValue: "页面 {{pages}} 个，设置区 {{sections}} 个",
                    pages: pageCount,
                    sections: sectionCount,
                  })}
                </div>
                {record.last_error && (
                  <div className="text-xs text-red-500 mt-1 break-words">
                    {t("plugins.lastError", { defaultValue: "上次错误" })}: {record.last_error}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Toggle
                  on={record.enabled}
                  onChange={(on) => setEnabled(record.id, on)}
                  aria-label={record.name}
                />
                <Button variant="outline" size="sm" onClick={() => reload(record.id)}>
                  {t("plugins.reload", { defaultValue: "重载" })}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setUninstallTarget(record.id)}>
                  {t("plugins.uninstall", { defaultValue: "卸载" })}
                </Button>
              </div>
            </div>

            {settingsSections
              .filter((s) => s.pluginId === record.id)
              .map((section) => (
                <div key={section.id} className="border-t border-border pt-3 mt-1">
                  <div className="text-sm font-semibold mb-2">{section.title}</div>
                  <PluginErrorBoundary pluginId={record.id}>{createElement(section.render)}</PluginErrorBoundary>
                </div>
              ))}
          </GlassCard>
        );
      })}

      {dragActive && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/40 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/60 bg-background/80 px-10 py-8 shadow-xl">
            <Icon name="upload" size={28} className="text-primary" />
            <div className="text-sm font-medium">
              {t("plugins.dropTitle", { defaultValue: "松开以安装插件" })}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("plugins.dropHint", { defaultValue: "仅支持 .zip 插件包" })}
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={!!uninstallTarget}
        onClose={() => setUninstallTarget(null)}
        title={t("plugins.confirmUninstall", {
          defaultValue: "确认卸载该插件？",
          name: targetRecord?.name,
        })}
      >
        <p className="text-sm">
          {t("plugins.uninstallHint", {
            defaultValue: "卸载后该插件的页面与设置区域将立即移除。",
            name: targetRecord?.name,
          })}
        </p>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" size="sm" onClick={() => setUninstallTarget(null)}>
            {t("common.cancel", { defaultValue: "取消" })}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              const id = uninstallTarget;
              setUninstallTarget(null);
              if (id) uninstall(id);
            }}
          >
            {t("plugins.uninstall", { defaultValue: "卸载" })}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
