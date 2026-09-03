---
name: integration
description: >-
  Connects existing React Query hooks to existing React Native screens: mappers,
  loading/error/empty, pagination, pull-to-refresh, and useXxxScreen only when
  needed. Use after API and UI handoffs exist. Do not redesign UI or invent API fields.
disable-model-invocation: true
---

# Integration Skill

How to wire API hooks to presentational UI in this repo.

Read [reference.md](reference.md) for `useXxxScreen` template, LegendList + PTR, and mapper patterns.

---

## When to Use

- API Handoff and UI Handoff exist (or confirmed existing in-repo).
- Task is connecting a hook to a screen, removing mocks, or adding loading/error/empty/pagination/PTR.

Do **not** start if either required handoff is missing. Do not create endpoints or restyle Figma.

---

## Inputs

Require from the parent prompt:

- **API Handoff** (hook name, keys, types, paging, files, `status: created | reused | none`)
- **UI Handoff** (screen file, view-model/props, `figmaFieldsWithoutApi`, components)

If `figmaFieldsWithoutApi` is non-empty: do **not** invent API fields. Leave those view-model props optional/placeholder and set `blockedOn` in the Integration Handoff.

---

## Workflow

1. Read the target screen and UI view-model types.
2. Read the hook, API types, and query keys from the API Handoff.
3. Search for an existing mapper in `src/utils/*Display.ts` and an existing `use*Screen.ts`.
4. Map API rows → view-model. Prefer a named mapper in `src/utils/` (see `mapProgramProgramTeamsApiRowToTeam`).
5. Connect the hook:
   - If `use*Screen.ts` already exists → put wiring there.
   - Else if the screen already inlines queries and a small bind is enough → wire in place; **do not** extract a hook.
   - Else if the screen is new, has multiple queries, or the `.tsx` would otherwise grow fetch/mapping logic → **create** `use{PascalName}Screen.ts`.
6. Remove obsolete mock/static list data.
7. Implement loading / error / empty / pagination / pull-to-refresh when the UI and API require them.
8. Preserve visual layout. Do not redesign components.
9. Run `npx tsc --noEmit` and targeted Jest (`__tests__/hooks/`, mapper tests).
10. Emit the **Integration Handoff**.

---

## `useXxxScreen.ts` Policy — Only When Needed

Create when:
- New screen that would otherwise put queries, mapping, and handlers in the `.tsx`
- Screen already follows the RosterLogs split
- Multiple queries, search, tabs, and list props would clutter the view

Do **not** create when:
- Existing screen already inlines a working hook and Integration is a small prop bind
- UI-only restyle with data flow already correct
- API Handoff `status: none` and no hook exists (stop; parent must run API Agent)

---

## States & State Guards

Reuse `Loader`, `ScreenErrorState`, `NoData`. Do not invent a new empty/error look.

| Condition | UI Component |
| --- | --- |
| `isLoading && data === undefined` | `<Loader />` |
| `isError && data === undefined` | `<ScreenErrorState onRetry={refetch} />` |
| Empty list | `<NoData message={STRINGS.*} />` |
| Search empty | `<NoData message={STRINGS.*} />` |
| Next page | `useInfiniteListProps` footer |
| Pull to refresh | `usePullToRefresh` → `legendListRefreshProps` |
| Missing route ids | error state; `enabled: false` on the query |

---

## Pagination and PTR

- Infinite lists: `useInfiniteListProps({ hasNextPage, isFetchingNextPage, fetchNextPage })`
- PTR: `usePullToRefresh({ queryKeys: [{camelName}Keys.all] })` — never `refetch()`, never `queryKeys: []`
- Spread both onto `LegendList`

---

## Loop Engineering: Integration Closed-Loop Verification

```
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│ 1. Wire Hook &  │ ────▶ │ 2. Verify TSC, Jest &  │ ────▶ │ 3. Inspect Diagnostics │─┐
│ View-Model      │       │    Loading/Error Guard │       │ & Self-Correct In-Loop │ │
└─────────────────┘       └────────────────────────┘       └────────────────────────┘ │
         ▲                                                                            │
         └────────────────────────── 🔁 REPEAT UNTIL 0 ERRORS ────────────────────────┘
```

1. **Verify State Robustness (3 State Guards):**
   - Confirm `isLoading` guards against accessing `undefined` properties.
   - Confirm `isError` renders `ScreenErrorState`.
   - Confirm empty fallback renders `NoData`.
2. **Execute In-Loop Compiler & Test Gate:**
   - Run `npx tsc --noEmit`.
   - Run targeted Jest mapper/hook tests.
3. **Emit Verified Integration Handoff:**
   - Emit handoff block when 0 errors remain.
