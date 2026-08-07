/// Minimal type declarations for the bare "sdk" specifier.
/// The real SDK module is bundled with the app (dist/plugin-sdk.js).
/// Plugins must import React from "sdk" (never from "react" directly).
declare module "sdk" {
  export const apiVersion: number;
  export function createElement(
    type: unknown,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): unknown;
  export const Fragment: symbol;
  export function useState<T>(initial: T): [T, (next: T | ((prev: T) => T)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
  export function useRef<T>(initial: T): { current: T };
  export function useCallback<T extends (...args: never[]) => unknown>(fn: T, deps?: unknown[]): T;
  export function useContext<T>(ctx: unknown): T;

  export const Button: unknown;
  export const Dialog: unknown;
  export const Icon: unknown;
  export const TextField: unknown;
  export const Toggle: unknown;

  const _default: {
    createElement: typeof createElement;
    Fragment: typeof Fragment;
    useState: typeof useState;
    useEffect: typeof useEffect;
    useRef: typeof useRef;
    useCallback: typeof useCallback;
  };
  export default _default;
}
