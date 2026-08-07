import { useEffect, useRef } from "react";

type Direction = "up" | "down" | "left" | "right";

interface GamepadCallbacks {
  onDirection: (dir: Direction) => void;
  onAction: () => void;  // A button
  onBack: () => void;    // B button
}

/**
 * Polls the Gamepad API and calls direction/action/back callbacks.
 * Uses a cooldown per direction to prevent repeat-fire.
 */
export function useGamepad({ onDirection, onAction, onBack }: GamepadCallbacks, active: boolean) {
  const cooldownRef = useRef<Record<string, number>>({});
  const callbacksRef = useRef({ onDirection, onAction, onBack });
  callbacksRef.current = { onDirection, onAction, onBack };

  useEffect(() => {
    if (!active) return;

    const COOLDOWN = 180; // ms between repeated inputs
    let raf: number;

    const poll = () => {
      const gamepads = navigator.getGamepads();
      for (const gp of gamepads) {
        if (!gp) continue;

        const now = Date.now();
        const axes = gp.axes;
        const buttons = gp.buttons;

        // D-pad or left stick
        const threshold = 0.5;
        const dirs: Direction[] = [];
        if (axes[0] < -threshold) dirs.push("left");
        if (axes[0] > threshold) dirs.push("right");
        if (axes[1] < -threshold) dirs.push("up");
        if (axes[1] > threshold) dirs.push("down");

        // D-pad buttons (button indices vary by controller)
        if (buttons[14]?.pressed) dirs.push("left");
        if (buttons[15]?.pressed) dirs.push("right");
        if (buttons[12]?.pressed) dirs.push("up");
        if (buttons[13]?.pressed) dirs.push("down");

        for (const d of dirs) {
          const last = cooldownRef.current[d] || 0;
          if (now - last > COOLDOWN) {
            cooldownRef.current[d] = now;
            callbacksRef.current.onDirection(d);
          }
        }

        // A button (index 0)
        if (buttons[0]?.pressed && now - (cooldownRef.current["action"] || 0) > COOLDOWN) {
          cooldownRef.current["action"] = now;
          callbacksRef.current.onAction();
        }

        // B button (index 1) or Back (index 8)
        if ((buttons[1]?.pressed || buttons[8]?.pressed) && now - (cooldownRef.current["back"] || 0) > COOLDOWN) {
          cooldownRef.current["back"] = now;
          callbacksRef.current.onBack();
        }
      }

      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [active]);
}
