import { MainPage } from "./pages/MainPage";
import { attachSdk, disposeRuntime } from "./runtime";
import type { PluginSdk } from "./types";

export function setup(sdk: PluginSdk) {
  attachSdk(sdk);

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
