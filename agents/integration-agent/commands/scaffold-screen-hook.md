# Scaffold Screen Hook Command

Scaffold a `use{PascalName}Screen.ts` screen controller hook separating data-fetching, search, tabs, and list props from view JSX.

---

## Instructions

1. Identify screen name and target API hook.
2. Generate `src/screens/{Stack}/{ScreenName}/use{ScreenName}Screen.ts`.
3. Include navigation, route params, debounced search (if needed), query hook, `useInfiniteListProps`, and `usePullToRefresh`.
4. Return typed interface matching screen requirements.
5. Run `npx tsc --noEmit`.
