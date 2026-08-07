# Bookmark Toggle Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Launcher’s favorite UI with the animated bookmark style from `animotion/收藏/style1.tsx`, implemented as a reusable component and reused across all visible favorite-entry points.

**Architecture:** Introduce a reusable `BookmarkToggle` UI component modeled on the reference animation, then wire it into the Launcher grid cards, Launcher list items, and Game Profile header. Keep the existing data model and `toggleFavorite` behavior unchanged. Context menus remain text commands and are not converted into animated bookmark widgets.

**Tech Stack:** React 18, TypeScript, existing Tailwind/CSS utility approach, existing `toggleFavorite` state flow in `useAppData`, and local state in `GameProfile`.

---

## Context

The current favorite experience is visually inconsistent:
- Launcher grid cards only show a static star indicator inside [src/components/GameCard.tsx](src/components/GameCard.tsx)
- Launcher list mode exposes favorite only through the context menu in [src/pages/Launcher.tsx](src/pages/Launcher.tsx)
- Game profile uses a separate icon button in [src/pages/GameProfile.tsx](src/pages/GameProfile.tsx)

The requested direction is to use the animated bookmark style from [animotion/收藏/style1.tsx](animotion/收藏/style1.tsx), but implement it as a reusable component rather than copy-pasting styled markup. The chosen scope is “全部入口”, interpreted as all visible favorite button entry points. Context-menu text actions stay as command entries because they are not visual button surfaces.

## Files

### Create
- `src/components/ui/BookmarkToggle.tsx` — reusable animated favorite/bookmark toggle component

### Modify
- `src/components/GameCard.tsx` — replace static favorite badge with interactive bookmark toggle
- `src/pages/Launcher.tsx` — add bookmark toggle to list items and pass favorite handler to grid cards
- `src/pages/GameProfile.tsx` — replace current favorite icon button with bookmark toggle

### Verify
- `npm run build`
- manual UI verification in `npm run tauri dev`

---

## Task 1: Create reusable BookmarkToggle component

**Files:**
- Create: `src/components/ui/BookmarkToggle.tsx`
- Reference: `animotion/收藏/style1.tsx`

- [ ] **Step 1: Create the component API**

Create a reusable component with a minimal API:

```tsx
interface BookmarkToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  size?: number;
  disabled?: boolean;
}
```

The component should render:
- a hidden checkbox input
- the animated bookmark SVG wrapper
- a button-like surface that can live inside cards or headers

Notes:
- Use `React.useId()` for the input/label linkage if needed.
- Prefer project-consistent TSX + className/CSS approach over introducing a new one-off `styled-components` dependency pattern.
- Preserve the reference animation idea: bookmark fill + burst circle/particle effect.

- [ ] **Step 2: Port the reference animation into the app style system**

Implement the bookmark visuals using one of these approaches:
- scoped inline `<style>` block within the component, or
- a local class structure plus CSS added in an existing shared stylesheet, if that stays tightly scoped.

The resulting component should preserve:
- unselected muted state
- hover feedback
- selected bookmark fill
- burst/circle animation on check

Recommended visual mapping:
- unselected icon: `muted-foreground`
- hover icon: slightly brighter foreground
- selected icon: warm gold/amber accent

Do not over-theme this first pass; match the reference style closely enough to be recognizable.

- [ ] **Step 3: Make the component interaction-safe in nested click targets**

Because it will live inside clickable cards, ensure callers can stop parent click behavior. The simplest approach is to let callers wrap the component in a click handler and call `stopPropagation()` there, rather than adding card-specific logic into the component.

- [ ] **Step 4: Build after component creation**

Run:

```sh
npm run build
```

Expected:
- Build succeeds.
- No JSX/TypeScript errors from the new component.

---

## Task 2: Replace Launcher grid-card favorite indicator

**Files:**
- Modify: `src/components/GameCard.tsx`
- Create/Use: `src/components/ui/BookmarkToggle.tsx`
- Caller: `src/pages/Launcher.tsx`

- [ ] **Step 1: Extend GameCard props**

Add a new optional prop:

```tsx
onToggleFavorite?: (g: GameInfo) => void;
```

Keep `isFavorite` as the state source.

- [ ] **Step 2: Import and render BookmarkToggle in the card**

Replace the current static favorite mark in the card title row:

Current area:
- `GameCard.tsx` around the title line, where `ICONS.starFilled` is conditionally rendered.

New behavior:
- render `BookmarkToggle` near the top-right of the card or aligned with the title area
- when clicked, call `onToggleFavorite?.(game)`
- stop propagation so clicking the favorite does not open the detail page or trigger the double-click launch flow

Recommended placement:
- top-right overlay in the cover area, or right edge of the title row

Recommendation: use the cover-area overlay placement for better visibility and to match the “bookmark” metaphor.

- [ ] **Step 3: Remove the old static star icon**

Delete the existing inline favorite star display from `GameCard.tsx` so there is only one favorite affordance.

- [ ] **Step 4: Wire the handler from Launcher grid mode**

In `src/pages/Launcher.tsx`, when rendering `GameCard`, pass:

```tsx
onToggleFavorite={(g) => { void toggleFavorite(g.id); }}
```

This should use the existing `toggleFavorite` function from `useAppData()` without changing persistence logic.

- [ ] **Step 5: Build after grid integration**

Run:

```sh
npm run build
```

Expected:
- Build succeeds.
- `GameCard` and `Launcher` compile with the new prop.

---

## Task 3: Add bookmark toggle to Launcher list view

**Files:**
- Modify: `src/pages/Launcher.tsx`
- Create/Use: `src/components/ui/BookmarkToggle.tsx`

- [ ] **Step 1: Import BookmarkToggle into Launcher**

Add the import near the other UI imports.

- [ ] **Step 2: Place the toggle in each list row**

In the list-view item markup in `Launcher.tsx`, add `BookmarkToggle` as a visible action in the row header area.

Recommended behavior:
- place it to the right of the game title/status badge row
- keep it visible regardless of running state
- use `checked={favorites.has(game.id)}`
- call `toggleFavorite(game.id)` on change
- stop propagation so it does not open the game profile or count as the first click of the card click timer

Implementation pattern:

```tsx
<div onClick={(e) => e.stopPropagation()}>
  <BookmarkToggle
    checked={favorites.has(game.id)}
    onChange={() => { void toggleFavorite(game.id); }}
  />
</div>
```

- [ ] **Step 3: Keep the context-menu favorite entry**

Do not remove the existing context-menu favorite command. It remains a secondary textual action.

- [ ] **Step 4: Build after list integration**

Run:

```sh
npm run build
```

Expected:
- Build succeeds.
- List rows compile and the favorite handler stays type-safe.

---

## Task 4: Replace GameProfile favorite button

**Files:**
- Modify: `src/pages/GameProfile.tsx`
- Create/Use: `src/components/ui/BookmarkToggle.tsx`

- [ ] **Step 1: Import BookmarkToggle**

Add the component import to `GameProfile.tsx`.

- [ ] **Step 2: Replace the current icon button**

Current code uses:

```tsx
<button onClick={handleToggleFavorite} className="text-lg">
  <img src={favorite ? ICONS.starFilled : ICONS.starOutline} ... />
</button>
```

Replace it with `BookmarkToggle`:

```tsx
<BookmarkToggle
  checked={favorite}
  onChange={() => { void handleToggleFavorite(); }}
/>
```

Keep the existing `favorite` state and `handleToggleFavorite` logic.

- [ ] **Step 3: Remove no-longer-needed icon imports if unused**

If `ICONS.starFilled` / `ICONS.starOutline` become unused in `GameProfile.tsx`, remove the unused icon imports only if they were used exclusively for favorite UI.

- [ ] **Step 4: Build after profile integration**

Run:

```sh
npm run build
```

Expected:
- Build succeeds.
- `GameProfile.tsx` compiles cleanly.

---

## Task 5: Manual verification

**Files:**
- Verify runtime behavior in:
  - `src/pages/Launcher.tsx`
  - `src/components/GameCard.tsx`
  - `src/pages/GameProfile.tsx`

- [ ] **Step 1: Launch the app**

Run:

```sh
npm run tauri dev
```

Expected:
- App launches normally.

- [ ] **Step 2: Verify Launcher grid favorite behavior**

In Launcher grid view, verify:
- each card shows the new bookmark-style favorite toggle
- clicking it does not open the game or trigger card navigation
- selecting and unselecting updates immediately
- the bookmark animation plays only on the favorite action

- [ ] **Step 3: Verify Launcher list favorite behavior**

In Launcher list view, verify:
- each row has the new bookmark-style favorite toggle
- clicking it does not trigger row navigation or launch behavior
- filter `favorites` still works
- context-menu favorite text action still works

- [ ] **Step 4: Verify GameProfile favorite behavior**

Open a game profile and verify:
- the old star button is replaced by the bookmark-style control
- clicking it updates favorite state correctly
- visual checked state matches stored state when the page loads

- [ ] **Step 5: Regression checks**

Verify that:
- Launcher grid double-click launch still works
- single click to open profile still works
- list row clicks still behave as before
- no layout overlap occurs in card overlays or title rows

---

## Scope guard

This plan intentionally does **not**:
- refactor favorite persistence logic
- change `toggleFavorite` behavior in `useAppData`
- replace context-menu text entries with animated bookmark controls
- add new settings/preferences for favorite style
- update Big Picture favorites in this pass unless a visible bookmark button already exists there

The scope is all visible favorite button entry points currently used in Launcher and GameProfile, with the new animated style delivered through one reusable component.
