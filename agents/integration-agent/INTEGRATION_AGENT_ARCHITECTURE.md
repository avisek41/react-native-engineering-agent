# Integration Agent Architecture

## 1. Role and Boundaries

The **Integration Agent** acts as the orchestrator and glue layer in a clean React Native architecture. It mediates between:
- **Presentational UI Components** (managed by UI Agent)
- **API Networking & Query Hooks** (managed by API Agent)
- **Device Hardware & Third-Party Native SDKs** (Push, Deep Linking, Firebase, Biometrics)

---

## 2. Structural Workflow

```
┌────────────────────────────────────────────────────────┐
│ UI Agent Output: Presentational Screen & Components    │
│ (src/screens/Main/ProfileScreen/ProfileScreen.tsx)     │
└──────────────────────────┬─────────────────────────────┘
                           │ Consumes ViewModel
                           ▼
┌────────────────────────────────────────────────────────┐
│ Integration Agent: Screen Coordinator Hook             │
│ (src/screens/Main/ProfileScreen/useProfileScreen.ts)   │
│ - Calls TanStack Query hooks                           │
│ - Runs Mapper: API DTO ➔ UI ViewModel                  │
│ - Exposes State: loading, error, refresh, actions      │
└──────────────────────────┬─────────────────────────────┘
                           │ Consumes API Queries
                           ▼
┌────────────────────────────────────────────────────────┐
│ API Agent Output: TanStack Query Hooks & DTOs          │
│ (src/hooks/queries/useProfileQuery.ts)                 │
└────────────────────────────────────────────────────────┘
```

---

## 3. Invariants & Rules

1. **Pure Presentation Remains Pure**: Screen `.tsx` components MUST NOT call `useQuery`, `useMutation`, or direct network methods. They only call their corresponding `use{Screen}Screen()` hook.
2. **Deterministic Mappers**: Backend API response shapes change independently of UI designs. All DTO-to-ViewModel translations must be isolated in pure mapper functions.
3. **Graceful Degradation**: Every hook must handle `isLoading`, `isError`, `isEmpty`, and network failure scenarios gracefully with retry callbacks.
4. **Platform Isolation**: Native SDKs (e.g. Firebase, OneSignal, Keychain) must be wrapped in `src/services/` modules, rather than imported directly into UI components.
