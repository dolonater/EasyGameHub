import { createContext, useContext, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ConfigPart { ui_animations?: boolean }

export const AnimationContext = createContext<boolean>(true);

export function useAnimation() {
  return useContext(AnimationContext);
}

/** Load animation setting from config once, provide via context. */
export function useAnimationProvider() {
  const [enabled, setEnabled] = useState(true);
  useEffect(() => {
    invoke<ConfigPart>("get_config").then(cfg => {
      setEnabled(cfg.ui_animations ?? true);
    }).catch(() => {});
  }, []);
  return enabled;
}
