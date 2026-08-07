# AddGame Inputs + Settings Toggle Theme Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Add Game custom-path form inputs and Settings toggles visually adapt to the active theme in both light and dark modes, using a soft primary-tinted style instead of hardcoded colors.

**Architecture:** Introduce one reusable themed text input component for standard form fields, then use it in the Add Game custom-path section. Update the shared Toggle component so its enabled track uses theme tokens with a soft primary accent, which automatically fixes all Settings-page toggles without per-page overrides.

**Tech Stack:** React 18, TypeScript, Tailwind utility classes, existing theme CSS variables (`--card`, `--border`, `--foreground`, `--muted-foreground`, `--primary`).

---

## Context

The current Add Game custom-path inputs use generic hardcoded border/background styling in [src/pages/AddGame.tsx](src/pages/AddGame.tsx), and the shared Toggle component uses a hardcoded enabled background (`bg-primary`) plus non-theme-aware disabled colors in [src/components/ui/Toggle.tsx](src/components/ui/Toggle.tsx). The requested direction is “方案 B”: do not only patch one local input, but extract a reusable theme-aware input style/component while keeping scope tight. The desired visual style is unified across light/dark themes with a **weak primary accent** rather than a full-strength solid primary fill.

## Files

### Create
- `src/components/ui/TextField.tsx` — reusable theme-aware text input for standard form fields

### Modify
- `src/pages/AddGame.tsx` — switch custom-path name/path fields to the reusable component
- `src/components/ui/Toggle.tsx` — make enabled/disabled track colors theme-adaptive with soft primary tint

### Verify
- `npm run build`
- manual UI check in `npm run tauri dev`

---

## Task 1: Add reusable themed text input

**Files:**
- Create: `src/components/ui/TextField.tsx`
- Reference: `src/components/ui/SearchInput.tsx`

- [ ] **Step 1: Create the reusable input component**

Create `src/components/ui/TextField.tsx` as a small `forwardRef` wrapper around `<input>`.

Use a base style like:

```tsx
import React, { forwardRef } from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField({ className = "", ...props }, ref) {
    return (
      <input
        ref={ref}
        className={[
          "w-full px-3 py-2 rounded-lg text-sm",
          "border border-border",
          "bg-card text-foreground placeholder:text-muted-foreground",
          "shadow-[0px_0px_20px_-18px] shadow-black/10",
          "transition-all duration-200 ease-out",
          "hover:border-primary/20 hover:bg-primary/[0.03]",
          "focus:outline-none focus:border-primary/35 focus:ring-2 focus:ring-primary/15 focus:bg-primary/[0.04]",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          "read-only:text-muted-foreground read-only:bg-primary/[0.02]",
          className,
        ].join(" ")}
        {...props}
      />
    );
  },
);

export default TextField;
```

Notes:
- Keep the style token-driven (`border-border`, `bg-card`, `text-foreground`, `primary` opacity variants).
- The weak primary accent is achieved with `primary/[0.03~0.04]` and `ring-primary/15`, not a solid primary fill.
- Do not add labels, validation logic, or variants yet.

- [ ] **Step 2: Build to catch TypeScript errors**

Run:

```sh
npm run build
```

Expected:
- Build succeeds.
- No import/type errors from the new component.

---

## Task 2: Use the reusable input in Add Game custom-path form

**Files:**
- Modify: `src/pages/AddGame.tsx`
- Create/Use: `src/components/ui/TextField.tsx`

- [ ] **Step 1: Import the new component**

Add:

```tsx
import TextField from "../components/ui/TextField";
```

near the existing UI imports.

- [ ] **Step 2: Replace the game-name input**

Replace the custom-name input block in the custom tab.

Current target area is around the `gameName` field in `AddGame.tsx`.

Use:

```tsx
<TextField
  value={customName}
  onChange={(e) => setCustomName(e.target.value)}
  placeholder="Elden Ring"
/>
```

- [ ] **Step 3: Replace the save-path input**

Replace the save-path field inside the browse row.

Use:

```tsx
<TextField
  value={customPath}
  onChange={(e) => setCustomPath(e.target.value)}
  className="flex-1"
  placeholder="C:\\Users\\..."
  readOnly
/>
```

Notes:
- Keep the existing browse button and behavior unchanged.
- Keep `readOnly`; this task is visual only, not a workflow change.

- [ ] **Step 4: Verify the Add Game form still builds**

Run:

```sh
npm run build
```

Expected:
- Build succeeds.
- `AddGame.tsx` compiles with the new component.

---

## Task 3: Make Toggle enabled state theme-adaptive

**Files:**
- Modify: `src/components/ui/Toggle.tsx`
- Affected consumers: `src/pages/Settings.tsx`

- [ ] **Step 1: Replace hardcoded toggle colors with theme-token styling**

Update the label classes in `Toggle.tsx`.

Current logic:

```tsx
on ? "bg-primary" : "bg-[#ccc] dark:bg-gray-600"
```

Replace with a softer token-driven style, for example:

```tsx
<label
  htmlFor={uid}
  className={[
    "absolute inset-0 rounded-[11px] cursor-pointer transition-all duration-300 border",
    on
      ? "bg-primary/20 border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.08)]"
      : "bg-muted/80 border-border",
  ].join(" ")}
>
```

And update the knob so it reads consistently on both states, for example:

```tsx
<span
  className={[
    "absolute top-[2px] w-[18px] h-[18px] rounded-full shadow-md transition-all duration-300",
    on
      ? "translate-x-[22px] bg-primary"
      : "translate-x-[2px] bg-card",
  ].join(" ")}
/>
```

Notes:
- Preserve current dimensions and motion.
- Do not change the public Toggle API.
- The goal is “weak primary accent”, not a loud neon or fully filled bar.

- [ ] **Step 2: Confirm Settings gets the new style automatically**

No Settings-page logic changes should be required, because `Settings.tsx` already consumes `Toggle` in multiple places.

Relevant usages include the dark-mode toggle, sidebar icon toggle, auto-backup toggle, auto-backup-on-exit toggle, UI animation toggle, and auto-start toggle in `src/pages/Settings.tsx`.

- [ ] **Step 3: Build after toggle changes**

Run:

```sh
npm run build
```

Expected:
- Build succeeds.
- No TypeScript or JSX errors in `Toggle.tsx` or `Settings.tsx`.

---

## Task 4: Manual UI verification

**Files:**
- Verify runtime behavior in:
  - `src/pages/AddGame.tsx`
  - `src/pages/Settings.tsx`

- [ ] **Step 1: Launch the app for visual verification**

Run:

```sh
npm run tauri dev
```

Expected:
- Dev app launches normally.

- [ ] **Step 2: Verify Add Game custom-path inputs**

Open **添加游戏 → 自定义路径** and verify:
- `游戏名称` input uses theme-aware background/border/text.
- `存档路径` input uses the same theme-aware style.
- Focus state shows a soft primary-tinted ring/border.
- In both light and dark modes, the fields no longer look like generic hardcoded white/gray boxes.
- The save-path field remains read-only and the browse button still works.

- [ ] **Step 3: Verify Settings toggles**

Open **设置** and verify:
- Toggle enabled state no longer uses a blunt solid fill.
- Enabled track uses a softer theme-adaptive primary tint.
- Disabled state follows muted/border theme tokens.
- The change works in both light and dark modes.
- The knob remains legible and animated correctly.

- [ ] **Step 4: Regression check interaction behavior**

Verify that:
- Entering custom game name still updates local state.
- Browsing for a folder still fills the path field.
- Toggling any Settings switch still updates state normally.
- No layout shift or clipping appears in Add Game or Settings.

---

## Scope guard

This plan intentionally does **not**:
- refactor every input across the app
- change Add Game workflow semantics
- change Toggle API/props
- redesign SearchInput, Select, Checkbox, or Dialog styling
- add validation or error messaging changes

The reusable input component is introduced now for Add Game, with the design ready for future adoption elsewhere if wanted.
