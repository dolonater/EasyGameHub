import { useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../../components/Notification";
import Button from "../../components/ui/Button";
import GlassCard from "../../components/ui/GlassCard";
import TabButtons from "../../components/ui/TabButtons";
import FormCard from "../../components/ui/FormCard";
import Icon from "../../components/ui/Icon";
import TextField from "../../components/ui/TextField";
import { createRouteSessionCache, routeCacheKey } from "../../lib/routeSessionCache";
import { useRouteCachedLoader } from "../../hooks/useRouteCachedLoader";

interface AuthEntry {
  id: string;
  issuer: string;
  accountName: string;
  tokenType: string;
  digits: number;
  period: number;
  isActive: boolean;
  code: string;
  remainingSeconds: number;
}

const authenticatorEntriesCache = createRouteSessionCache<AuthEntry[]>();

export default function Authenticator({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const [formIssuer, setFormIssuer] = useState("Steam");
  const [formAccount, setFormAccount] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formUri, setFormUri] = useState("");
  const [importMode, setImportMode] = useState(false);

  const { data, loading, refresh } = useRouteCachedLoader<AuthEntry[]>({
    cache: authenticatorEntriesCache,
    key: routeCacheKey("steam-authenticator", { entries: true }),
    load: () => invoke<AuthEntry[]>("get_auth_entries"),
    pollMs: 1000,
    onError: (e) => showToast("error", String(e)),
  });
  const entries = data ?? [];

  const handleAdd = async () => {
    if (importMode) {
      if (!formUri.trim()) return;
      try {
        await invoke("import_from_uri", { uri: formUri.trim() });
        showToast("success", t("authenticator.imported"));
        setShowAdd(false);
        setFormUri("");
        await refresh({ force: true, keepVisible: true });
      } catch (e: any) {
        showToast("error", String(e));
      }
    } else {
      if (!formSecret.trim() || !formAccount.trim()) return;
      try {
        await invoke("add_auth_entry", {
          issuer: formIssuer || "Unknown",
          accountName: formAccount,
          secretBase32: formSecret.replace(/\s/g, ""),
          tokenType: "totp",
          digits: 6,
          period: 30,
        });
        showToast("success", t("authenticator.added"));
        setShowAdd(false);
        setFormAccount("");
        setFormSecret("");
        await refresh({ force: true, keepVisible: true });
      } catch (e: any) {
        showToast("error", String(e));
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke("delete_auth_entry", { id });
      showToast("success", t("authenticator.deleted"));
      await refresh({ force: true, keepVisible: true });
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  if (loading && !data) {
    return (
      <div className={embedded ? "animate-fade-in" : "max-w-lg mx-auto animate-fade-in"}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-8 w-28 rounded bg-secondary/40" />
          <div className="h-9 w-20 rounded bg-secondary/40" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <GlassCard key={i} className="flex items-center gap-3 rounded-lg shadow relative overflow-hidden p-4">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-secondary/40" />
                <div className="h-3 w-36 rounded bg-secondary/30" />
              </div>
              <div className="flex-shrink-0 space-y-2 text-right">
                <div className="h-10 w-28 rounded bg-secondary/40" />
                <div className="h-3 w-16 rounded bg-secondary/30 ml-auto" />
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "max-w-lg mx-auto"}>
      <div className="flex items-center justify-between mb-4">
        {!embedded && (
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{t("authenticator.title")}</h1>
            {loading && data && (
              <span className="inline-flex items-center justify-center text-muted-foreground animate-spin" title={t("common.loading")}>
                <Icon name="reset" size={14} />
              </span>
            )}
          </div>
        )}
        <Button size="sm" className={embedded ? "ml-auto" : ""} onClick={() => setShowAdd(!showAdd)}>
          + {t("authenticator.add")}
        </Button>
      </div>

      {entries.length === 0 && !showAdd && (
        <FormCard title={t("authenticator.empty")} subtitle={t("authenticator.emptyHint")} className="mx-auto text-center">
          <div className="flex justify-center">
            <Icon name="key" size={40} className="text-foreground dark:text-white/85" />
          </div>
        </FormCard>
      )}

      {showAdd && (
        <FormCard className="mx-auto mb-4">
          <div className="mb-3">
            <TabButtons
              name="auth-mode"
              value={importMode ? "import" : "manual"}
              size="sm"
              onChange={(v) => setImportMode(v === "import")}
              options={[
                { value: "manual", label: t("authenticator.manual") },
                { value: "import", label: t("authenticator.importUri") },
              ]}
            />
          </div>

          {importMode ? (
            <div>
              <TextField
                type="text"
                value={formUri}
                onChange={(e) => setFormUri(e.target.value)}
                placeholder="otpauth://totp/..."
                className="w-full"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <TextField type="text" value={formIssuer} onChange={(e) => setFormIssuer(e.target.value)} placeholder={t("authenticator.issuer")} className="w-full" />
              </div>
              <div>
                <TextField type="text" value={formAccount} onChange={(e) => setFormAccount(e.target.value)} placeholder={t("authenticator.account")} className="w-full" />
              </div>
              <div>
                <TextField type="text" value={formSecret} onChange={(e) => setFormSecret(e.target.value)} placeholder={t("authenticator.secret")} className="w-full font-mono" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" size="sm" onClick={handleAdd}>
              {t("authenticator.add")}
            </Button>
          </div>
        </FormCard>
      )}

      <div className="space-y-2">
        {entries.map((entry) => (
          <GlassCard key={entry.id} className="flex items-center gap-3 p-4 rounded-lg shadow relative overflow-hidden">
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate text-slate-700 dark:text-foreground">{entry.issuer}</div>
              <div className="text-xs text-slate-500 dark:text-muted-foreground truncate">{entry.accountName}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="inline-flex items-center gap-1 rounded-[5px] px-3 py-2" style={{ background: "#333" }}>
                {(entry.code.match(/.{1,3}/g) || [entry.code]).map((part: string, i: number) => (
                  <span key={i} className="text-xl font-mono font-bold text-white tracking-wider">{part}</span>
                ))}
              </div>
              <div className="flex items-center justify-end gap-1 mt-1.5">
                <div className="w-8 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-1000"
                    style={{ width: `${((entry.period - entry.remainingSeconds) / entry.period) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500 dark:text-muted-foreground tabular-nums w-5">{entry.remainingSeconds}s</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(entry.id)}
              className="!h-7 !w-7 !p-0 !gap-0 text-slate-400 dark:text-muted-foreground flex-shrink-0"
              title={t("authenticator.delete")}
            >
              ✕
            </Button>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
