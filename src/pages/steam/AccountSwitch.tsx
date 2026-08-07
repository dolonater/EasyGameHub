import { useEffect, useMemo, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../../components/Notification";
import Button from "../../components/ui/Button";
import FormCard from "../../components/ui/FormCard";
import AccountCard from "../../components/ui/AccountCard";
import Dialog from "../../components/ui/Dialog";
import ContextMenu, { type MenuItem } from "../../components/ui/ContextMenu";
import TextField from "../../components/ui/TextField";
import Icon from "../../components/ui/Icon";
import { copyText, getSteamIdFormats, getSteamProfileLinks } from "../../lib/steamAccount";
import { createRouteSessionCache } from "../../lib/routeSessionCache";
import { useRouteCachedLoader } from "../../hooks/useRouteCachedLoader";

interface SteamAccount {
  steamId64: string;
  accountName: string;
  personaName: string;
  rememberPassword: boolean;
  mostRecent: boolean;
  avatarHash: string | null;
  remark?: string | null;
}

/** Snapshot cached across tab remounts (module-level → survives unmount). */
interface AccountsSnapshot {
  accounts: SteamAccount[];
  currentSteamId: string | null;
  steamStatus: { found: boolean; path?: string; message?: string } | null;
}

/** Shared session cache — re-entering the tab renders instantly, no reload flash. */
const accountSwitchCache = createRouteSessionCache<AccountsSnapshot>();

const PERSONA_ITEMS = [
  { state: 7, key: "steam.personaInvisible", fallback: "隐身" },
  { state: 0, key: "steam.personaOffline", fallback: "离线" },
  { state: 1, key: "steam.personaOnline", fallback: "在线" },
  { state: 2, key: "steam.personaBusy", fallback: "忙碌" },
  { state: 3, key: "steam.personaAway", fallback: "离开" },
  { state: 4, key: "steam.personaSnooze", fallback: "打盹" },
  { state: 5, key: "steam.personaLookingToTrade", fallback: "想交易" },
  { state: 6, key: "steam.personaLookingToPlay", fallback: "想玩游戏" },
] as const;

export default function AccountSwitch({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useTranslation();
  const [switching, setSwitching] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; account: SteamAccount } | null>(null);
  const [renameTarget, setRenameTarget] = useState<SteamAccount | null>(null);
  const [remarkValue, setRemarkValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SteamAccount | null>(null);
  const [deleteUserdata, setDeleteUserdata] = useState(false);

  const loadSnapshot = useCallback(async (): Promise<AccountsSnapshot> => {
    const [accts, currentUser, status] = await Promise.all([
      invoke<SteamAccount[]>("get_steam_accounts"),
      invoke<SteamAccount | null>("get_current_steam_user"),
      invoke<{ found: boolean; path?: string; message?: string }>("check_steam_status"),
    ]);
    return {
      accounts: accts,
      currentSteamId: currentUser?.steamId64 || accts.find((account) => account.mostRecent)?.steamId64 || null,
      steamStatus: status,
    };
  }, []);

  // Cached snapshot: re-entering the tab shows data instantly (no loading
  // flash), with a 30s background poll keeping the account list fresh.
  const { data, loading, refresh, updateCachedData } = useRouteCachedLoader<AccountsSnapshot>({
    cache: accountSwitchCache,
    key: "account-switch",
    pollMs: 30_000,
    load: loadSnapshot,
    onError: (e) => showToast("error", String(e)),
  });

  const accounts = data?.accounts ?? [];
  const currentSteamId = data?.currentSteamId ?? null;
  const steamStatus = data?.steamStatus ?? null;

  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleContextMenu = (e: React.MouseEvent, account: SteamAccount) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, account });
  };

  const handleSwitch = async (steamId64: string, options?: { offlineMode?: boolean; personaState?: number }) => {
    setConfirmId(null);
    setSwitching(steamId64);
    try {
      if (options?.offlineMode || options?.personaState !== undefined) {
        await invoke("switch_steam_account_with_options", {
          steamId64,
          offlineMode: !!options?.offlineMode,
          personaState: options?.personaState ?? null,
        });
      } else {
        await invoke("switch_steam_account", { steamId64 });
      }
      updateCachedData((prev) => {
        const accounts = prev?.accounts ?? [];
        return {
          accounts: accounts.map((account) => ({
            ...account,
            mostRecent: account.steamId64 === steamId64,
          })),
          currentSteamId: steamId64,
          steamStatus: prev?.steamStatus ?? null,
        };
      });
      showToast("success", t("steam.switchSuccess"));
      setTimeout(() => { void refresh({ force: true, keepVisible: true }); }, 3000);
    } catch (e: any) {
      showToast("error", String(e));
    } finally {
      setSwitching(null);
    }
  };

  const applyRemark = async () => {
    if (!renameTarget) return;
    try {
      const nextRemark = await invoke<string | null>("set_steam_account_remark", {
        steamId64: renameTarget.steamId64,
        remark: remarkValue,
      });
      updateCachedData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          accounts: prev.accounts.map((account) =>
            account.steamId64 === renameTarget.steamId64
              ? { ...account, remark: nextRemark }
              : account,
          ),
        };
      });
      setRenameTarget(null);
      setRemarkValue("");
      showToast("success", t("steam.remarkSaved", { defaultValue: "备注名已保存" }));
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await invoke("delete_steam_account_data", {
        steamId64: deleteTarget.steamId64,
        deleteUserdata,
      });
      setDeleteTarget(null);
      setDeleteUserdata(false);
      if (currentSteamId === deleteTarget.steamId64) {
        updateCachedData((prev) => (prev ? { ...prev, currentSteamId: null } : prev));
      }
      await refresh({ force: true, keepVisible: true });
      showToast("success", t("steam.deleted", { defaultValue: "已删除" }));
    } catch (e: any) {
      showToast("error", String(e));
    }
  };

  const contextMenuItems: MenuItem[] = useMemo(() => {
    if (!contextMenu) return [];
    const account = contextMenu.account;
    const steamIdFormats = getSteamIdFormats(account.steamId64);
    const links = getSteamProfileLinks(account.steamId64);
    const displayName = account.remark?.trim()
      ? `${account.personaName || account.accountName} (${account.remark.trim()})`
      : (account.personaName || account.accountName);

    return [
      {
        label: t("steam.switchToThisAccount", { defaultValue: "切换到此账号" }),
        onClick: () => void handleSwitch(account.steamId64),
      },
      {
        label: t("steam.launchOfflineMode", { defaultValue: "以离线模式启动" }),
        onClick: () => void handleSwitch(account.steamId64, { offlineMode: true }),
      },
      {
        label: t("steam.loginAs", { defaultValue: "登录为" }),
        sepBefore: true,
        children: PERSONA_ITEMS.map((item) => ({
          label: t(item.key, { defaultValue: item.fallback }),
          onClick: () => void handleSwitch(account.steamId64, { personaState: item.state }),
        })),
      },
      {
        label: t("common.copy", { defaultValue: "复制" }),
        sepBefore: true,
        children: [
          {
            label: t("steam.copyProfile", { defaultValue: "复制个人资料" }),
            children: [
              {
                label: t("steam.copyProfileCommunityUrl", { defaultValue: "社区 URL" }),
                onClick: async () => {
                  await copyText(links.community);
                  showToast("success", t("steam.copied", { defaultValue: "已复制" }));
                },
              },
              {
                label: t("steam.copyProfileNickname", { defaultValue: "Steam 昵称" }),
                onClick: async () => {
                  await copyText(account.personaName || account.accountName);
                  showToast("success", t("steam.copied", { defaultValue: "已复制" }));
                },
              },
              {
                label: t("steam.copyProfileUsername", { defaultValue: "Steam 用户名" }),
                onClick: async () => {
                  await copyText(account.accountName);
                  showToast("success", t("steam.copied", { defaultValue: "已复制" }));
                },
              },
            ],
          },
          {
            label: t("steam.copySteamId", { defaultValue: "复制 SteamID" }),
            children: [
              {
                label: t("steam.copySteamIdClassicShort", { defaultValue: "SteamID [STEAM0:~]" }),
                onClick: async () => {
                  await copyText(steamIdFormats.steamId);
                  showToast("success", t("steam.copied", { defaultValue: "已复制" }));
                },
              },
              {
                label: t("steam.copySteamId3Short", { defaultValue: "SteamID3 [U:1:~]" }),
                onClick: async () => {
                  await copyText(steamIdFormats.steamId3);
                  showToast("success", t("steam.copied", { defaultValue: "已复制" }));
                },
              },
              {
                label: t("steam.copySteamId32Short", { defaultValue: "SteamID32" }),
                onClick: async () => {
                  await copyText(steamIdFormats.steamId32);
                  showToast("success", t("steam.copied", { defaultValue: "已复制" }));
                },
              },
              {
                label: t("steam.copySteamId64Short", { defaultValue: "SteamID64 7656~" }),
                onClick: async () => {
                  await copyText(steamIdFormats.steamId64);
                  showToast("success", t("steam.copied", { defaultValue: "已复制" }));
                },
              },
            ],
          },
        ],
      },
      {
        label: t("steam.openLink", { defaultValue: "打开链接" }),
        children: [
          { label: "Steam 社区", onClick: () => invoke("open_url", { url: links.community }) },
          { label: "SteamRep", onClick: () => invoke("open_url", { url: links.steamRep }) },
          { label: "SteamRepCN", onClick: () => invoke("open_url", { url: links.steamRepCn }) },
          { label: "SteamDB", onClick: () => invoke("open_url", { url: links.steamDb }) },
          { label: "SteamGifts", onClick: () => invoke("open_url", { url: links.steamGifts }) },
          { label: "SteamTrades", onClick: () => invoke("open_url", { url: links.steamTrades }) },
          { label: "Achievement Stats", onClick: () => invoke("open_url", { url: links.achievementStats }) },
          { label: "Backpack.tf", onClick: () => invoke("open_url", { url: links.backpackTf }) },
        ],
      },
      {
        label: t("steam.editRemark", { defaultValue: "修改备注名" }),
        onClick: () => {
          setRenameTarget(account);
          setRemarkValue(account.remark || "");
        },
        sepBefore: true,
      },
      {
        label: t("steam.createDesktopShortcut", { defaultValue: "创建桌面快捷方式" }),
        onClick: async () => {
          const path = await invoke<string>("create_steam_account_shortcut", {
            steamId64: account.steamId64,
            displayName,
          });
          showToast("success", `${t("steam.shortcutCreated", { defaultValue: "桌面快捷方式已创建" })}：${path}`);
        },
      },
      {
        label: t("steam.openUserdataFolder", { defaultValue: "打开 userdata 文件夹" }),
        onClick: async () => {
          try {
            await invoke("open_steam_account_userdata_folder", { steamId64: account.steamId64 });
          } catch (e: any) {
            showToast("error", String(e));
          }
        },
      },
      {
        label: t("common.remove", { defaultValue: "删除" }),
        onClick: () => {
          setDeleteTarget(account);
          setDeleteUserdata(false);
        },
        danger: true,
      },
    ];
  }, [contextMenu, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-muted-foreground">{t("common.loading")}</div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "max-w-2xl mx-auto"}>
      {!embedded && (
        <>
          <h1 className="text-2xl font-bold mb-2">{t("steam.accountSwitch")}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {t("steam.accountSwitchDesc")}
          </p>
        </>
      )}

      {accounts.length === 0 ? (
        <FormCard className="mx-auto text-center">
          <Icon name="search" size={40} className="mx-auto text-muted-foreground" />
          <h2 className="text-2xl font-medium text-slate-700 dark:text-foreground">{t("steam.noAccounts")}</h2>
          <p className="text-slate-500 dark:text-muted-foreground text-sm">{t("steam.noAccountsHint")}</p>
          {steamStatus && (
            <div className="mt-4 text-xs px-3 py-2 bg-slate-50 dark:bg-secondary/30 rounded-md inline-block text-left text-slate-500 dark:text-muted-foreground">
              <div className="inline-flex items-center gap-1.5">{steamStatus.found ? <Icon name="success" size={14} className="text-green-600 dark:text-green-400" /> : <Icon name="error" size={14} className="text-red-600 dark:text-red-400" />} <span>Steam: {steamStatus.found ? steamStatus.path : "未检测到"}</span></div>
            </div>
          )}
        </FormCard>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
          {accounts.map((account) => {
            const displayName = account.remark?.trim()
              ? `${account.personaName || account.accountName} (${account.remark.trim()})`
              : (account.personaName || account.accountName);

            return (
              <div key={account.steamId64} onContextMenu={(e) => handleContextMenu(e, account)}>
                <AccountCard
                  avatarUrl={account.avatarHash ? `https://avatars.steamstatic.com/${account.avatarHash}_medium.jpg` : null}
                  personaName={displayName}
                  accountName={account.accountName}
                  isActive={account.steamId64 === currentSteamId}
                  activeLabel={t("steam.currentAccount")}
                  action={
                    account.steamId64 !== currentSteamId ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmId(
                          confirmId === account.steamId64 ? null : account.steamId64,
                        )}
                        disabled={switching === account.steamId64}
                      >
                        {switching === account.steamId64
                          ? t("steam.switching")
                          : t("steam.switch")}
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      <Dialog
        open={renameTarget !== null}
        onClose={() => {
          setRenameTarget(null);
          setRemarkValue("");
        }}
        title={t("steam.editRemark", { defaultValue: "修改备注名" })}
        actions={(
          <>
            <Button variant="outline" onClick={() => { setRenameTarget(null); setRemarkValue(""); }}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={() => { void applyRemark(); }}>
              {t("common.save")}
            </Button>
          </>
        )}
      >
        <div className="space-y-2">
          <p>{t("steam.remarkHint", { defaultValue: "可为空，用于重置备注名。" })}</p>
          <TextField
            value={remarkValue}
            onChange={(e) => setRemarkValue(e.target.value)}
            placeholder={t("steam.remarkPlaceholder", { defaultValue: "输入备注名" })}
          />
        </div>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteUserdata(false);
        }}
        title={t("steam.deleteAccountTitle", { defaultValue: "删除账号数据" })}
        actions={(
          <>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteUserdata(false); }}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => { void handleDelete(); }}>
              {t("common.remove")}
            </Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm">
          <p>
            {t("steam.deleteAccountDesc", { defaultValue: "确认删除该账号在本机的登录记录？" })}
          </p>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={deleteUserdata}
              onChange={(e) => setDeleteUserdata(e.target.checked)}
            />
            <span>{t("steam.deleteUserdataToo", { defaultValue: "同时删除 userdata 文件夹" })}</span>
          </label>
        </div>
      </Dialog>

      <Dialog
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title={t("steam.confirmSwitch")}
        actions={(
          <>
            <Button variant="outline" onClick={() => setConfirmId(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="primary" onClick={() => { void handleSwitch(confirmId!); }}>
              {t("steam.confirm")}
            </Button>
          </>
        )}
      >
        {(() => {
          const target = accounts.find((a) => a.steamId64 === confirmId);
          return (
            <>
              <p>
                {t("steam.confirmSwitchDesc")}{" "}
                <strong>{target?.personaName || target?.accountName}</strong>
              </p>
              <div className="flex items-start gap-2 mt-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
                <Icon name="warning" size={16} className="mt-0.5 flex-shrink-0 text-amber-700 dark:text-amber-300" />
                <span>{t("steam.restartWarning")}</span>
              </div>
            </>
          );
        })()}
      </Dialog>
    </div>
  );
}
