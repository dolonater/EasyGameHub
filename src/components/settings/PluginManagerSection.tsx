import type { TFunction } from "i18next";
import { createElement, useState } from "react";
import Button from "../ui/Button";
import Dialog from "../ui/Dialog";
import GlassCard from "../ui/GlassCard";
import Icon from "../ui/Icon";
import Toggle from "../ui/Toggle";
import { usePlugins } from "../../plugins/PluginProvider";
import PluginErrorBoundary from "../../plugins/ErrorBoundary";

interface PluginManagerSectionProps {
  t: TFunction;
}

export default function PluginManagerSection({ t }: PluginManagerSectionProps) {
  const { records, pages, settingsSections, install, reload, uninstall, setEnabled } = usePlugins();
  const [uninstallTarget, setUninstallTarget] = useState<string | null>(null);

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
        <Button variant="primary" size="sm" onClick={install}>
          <Icon name="addGame" size={14} className="mr-1" />
          {t("plugins.install", { defaultValue: "安装插件" })}
        </Button>
      </div>

      {records.length === 0 && (
        <GlassCard className="p-6 text-center text-sm text-muted-foreground">
          {t("plugins.none", { defaultValue: "尚未安装任何插件" })}
        </GlassCard>
      )}

      {records.map((record) => {
        const pageCount = pages.filter((p) => p.pluginId === record.id).length;
        const sectionCount = settingsSections.filter((s) => s.pluginId === record.id).length;
        return (
          <GlassCard key={record.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{record.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">v{record.version}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    api v{record.api_version}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{record.id}</div>
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
