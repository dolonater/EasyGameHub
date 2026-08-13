import { MainPage } from "./pages/MainPage";
import { attachSdk, disposeRuntime, loadConfig, refreshLoginStatus } from "./runtime";
import type { PluginSdk } from "./types";

export function setup(sdk: PluginSdk) {
  attachSdk(sdk);

  // 启动即加载持久化配置（搜索历史/播放偏好等），刷新/重挂载后不丢失
  void loadConfig().catch(() => undefined);
  void refreshLoginStatus().catch(() => undefined);

  sdk.lifecycle.onDispose(() => {
    disposeRuntime();
  });

  sdk.ui.registerPage({
    path: "home",
    title: "Bilibili",
    icon: "playFilled",
    render: MainPage,
  });
}

export function teardown() {
  disposeRuntime();
}
