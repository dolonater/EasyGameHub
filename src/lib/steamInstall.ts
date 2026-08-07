import { invoke } from "@tauri-apps/api/core";
import { showToast } from "../components/Notification";

export type SteamInstallStatus =
  | "started"
  | "throttled"
  | "already_downloading"
  | "already_installed";

type Translate = (key: string, options?: any) => string;

export async function startSteamInstall(appId: number, name: string | null | undefined, t: Translate) {
  const displayName = name || `App ${appId}`;
  const status = await invoke<SteamInstallStatus>("start_steam_install", {
    appId,
    name: name ?? null,
  });

  if (status === "already_downloading") {
    showToast(
      "info",
      t("steam.installAlreadyDownloading", {
        name: displayName,
        defaultValue: `${displayName} 已在下载中`,
      }),
    );
    return status;
  }

  if (status === "already_installed") {
    showToast(
      "info",
      t("steam.installAlreadyInstalled", {
        name: displayName,
        defaultValue: `${displayName} 已安装`,
      }),
    );
    return status;
  }

  if (status === "throttled") {
    showToast(
      "info",
      t("steam.installRequestSent", {
        name: displayName,
        defaultValue: `${displayName} 安装请求已发送，请勿重复点击`,
      }),
    );
    return status;
  }

  showToast("success", `${t("steam.installing") || "Installing"} ${displayName}`);
  return status;
}
