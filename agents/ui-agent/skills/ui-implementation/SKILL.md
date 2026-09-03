---
name: ui-implementation
description: >-
  Implements presentational React Native screens and components from Figma or a
  UI spec using Gluestack, design tokens, and existing components. Does not
  create React Query hooks, useXxxScreen data hooks, or API files.
disable-model-invocation: true
---

# UI Implementation Skill

This skill defines how to build presentational UI in React Native apps. The **UI Agent** owns Figma decisions, layout, tokens, and component reuse. The **Integration Agent** wires data later.

Read [reference.md](reference.md) for tokens, component reuse, LegendList visual pattern, and navigation.

**This codebase is the source of truth for architecture.**  
**Figma / screenshot is the source of truth for visual design.**

---

## When to Use

- User provided Screen + File + Design (Figma URL, screenshot, or UI spec).
- User asked to implement or restyle a screen / component.
- UI bug fix or visual alignment issue.

### Do NOT use this skill to:
- Create or modify `src/api/`, React Query hooks, or endpoint constants.
- Create `use{PascalName}Screen.ts` (Integration does that when needed).
- Call `useInfiniteQuery` / `useQuery` / `useMutation` / `usePullToRefresh` / `useInfiniteListProps`.

---

## Input Checklist

```
Screen       : Player Updates
File         : src/screens/Main/RosterLogs/RosterLogs.tsx
Design       : <Figma URL or Screenshot>
Stack        : Main (or Auth)
Requirements : (optional extra constraints)
```

Ask only for missing `Screen` + `File` + `Design`. Do not write code until those exist.

---

## Step 1: Search First (Never Start in Isolation)

1. **Target File**: If it already exists, inspect and preserve all business logic and data wiring.
2. **Sibling Files**: Check `Components/`, `types.ts`, existing hooks.
3. **Shared Components**: Check `src/components/ui/index.ts` and `src/components/index.ts`.
4. **Similar Screen**: (e.g. list → `RosterLogs`, form → `InvitePlayer`, tabs → `Notifications`).
5. **Strings Module**: Check `src/constant/strings/index.ts`.
6. **Theme & Tokens**: `src/theme/color.ts`, `src/theme/fonts.ts`, `src/constant/designToken.ts`.

---

## Step 2: File Structure (Presentational Only)

Existing screens live under `src/screens/Main/` or `src/screens/Auth/` — never `src/screens/{PascalName}/` directly.

```
src/screens/{Auth|Main}/{PascalName}/
  {PascalName}.tsx          ← Layout, testIDs, compose components
  types.ts                  ← Screen-local view-model types (not API DTOs)
  Components/               ← Screen-local presentational pieces
  index.ts                  ← export { default as {PascalName} }
src/constant/strings/{camelName}.ts
src/constant/strings/index.ts
```

---

## Step 3: Editing vs. Creating

### Editing an Existing Screen
- Preserve query keys, hooks, route params, and pagination.
- Change layout, styling, and presentational components only.
- Do not remove working data hooks to "leave a slot for integration".

### New Screen (UI-First / UI-Only)
- Render presentational structure.
- Use typed empty arrays or mock visual placeholders for list items.
- Place `Loader` / `NoData` / `ScreenErrorState` as layout slots.
- Do not write fetch logic or data hooks.

---

## Step 4: Closed-Loop Self-Verification

Execute the **Closed-Loop UI Verification Engine** before handoff:

1. **Verify Token & Design System Invariants**:
   - Confirm colors use `COLORS.*` (no raw hex).
   - Confirm strings use `STRINGS.*` (no raw text).
   - Confirm icon names exist in `lucide-react-native`.
2. **Execute In-Loop Compiler Gate**:
   - Run `npx tsc --noEmit`.
   - Fix all missing props, invalid JSX elements, or broken imports in-loop.
3. **Emit Verified UI Handoff**:
   - Provide the complete UI Handoff markdown block.
