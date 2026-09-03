# Integration Agent 🔄

An enterprise-grade, standalone Integration, Data-Wiring, and Native Module Agent for React Native applications.

The **Integration Agent** specializes in connecting presentational UI screens with backend queries/mutations via screen coordinator hooks (`use{Screen}Screen.ts`), mapping server DTOs to view-models, managing pagination / pull-to-refresh lifecycles, and orchestrating native SDKs (Firebase, Push Notifications, Deep Links, In-App Purchases, Camera/Permissions).

---

## 📦 Directory Overview

```
integration-agent/
├── agent.md                          # Cursor / AI Agent system prompt
├── README.md                         # Comprehensive agent documentation
├── INTEGRATION_AGENT_ARCHITECTURE.md # Architecture, contracts & boundary rules
├── package.json                      # Standalone package definition
├── integration-agent.js              # CLI tool for hook generation & wiring validation
│
├── commands/                         # AI Agent / Cursor Commands
│   ├── build-screen-hook.md          # Scaffold screen coordinator hook
│   ├── integrate-native-sdk.md       # Scaffold native SDK service wrapper
│   ├── wire-pagination.md            # Scaffold infinite scroll & pull-to-refresh
│   └── validate-integration.md       # Verify architectural boundaries & typing
│
├── skills/                           # Agent Skills & Domain Guides
│   ├── data-wiring/
│   │   ├── SKILL.md                  # Protocol for wiring UI screens to TanStack queries
│   │   └── reference.md              # Patterns for hooks, mappers, pagination & errors
│   ├── native-modules/
│   │   └── SKILL.md                  # Native SDK and platform bridge integration guide
│   └── mapper-generator/
│       └── SKILL.md                  # DTO-to-ViewModel mapping best practices
│
├── rules/                            # Strict Engineering Guidelines (.mdc)
│   ├── integration-standards.mdc     # Separation of concerns, hook structure, and error handling
│   ├── no-direct-api-in-components.mdc # Enforce zero networking in JSX components
│   └── closed-loop-integration.mdc   # TypeScript compiler gate & state verification
│
├── templates/                        # Reusable Integration Templates
│   ├── ScreenHookTemplate.ts         # Screen coordinator hook boilerplate
│   ├── MapperTemplate.ts             # DTO-to-ViewModel transformation blueprint
│   └── NativeServiceTemplate.ts      # Native SDK wrapper boilerplate
│
└── lib/                              # CLI Validator & Generator
    ├── constants.js                  # Validation regexes & exit codes
    ├── validator.js                  # Static boundary & hook checker
    └── scaffolder.js                 # CLI code generator for hooks & mappers
```

---

## 🎯 Separation of Concerns

```
                  ┌────────────────────────┐
                  │      Parent Agent      │
                  └───────────┬────────────┘
                              │
             ┌────────────────┴────────────────┐
             ↓                                 ↓
      ┌──────────────┐                  ┌──────────────┐
      │   UI Agent   │                  │  API Agent   │
      │ (Figma ➔ UI) │                  │ (Swagger ➔   │
      │  [Pure View] │                  │  Hooks/Types)│
      └──────┬───────┘                  └──────┬───────┘
             │                                 │
             │ (UI Handoff)                    │ (API Handoff)
             └────────────────┬────────────────┘
                              ↓
                  ┌────────────────────────┐
                  │   Integration Agent    │
                  │ (Wires ViewModel ➔ API)│
                  │ (use{Screen}Screen.ts) │
                  └────────────────────────┘
```

| Responsibility | UI Agent | API Agent | Integration Agent | Security Agent |
|---|:---:|:---:|:---:|:---:|
| Figma / Layout Parsing | ✅ **Owner** | ❌ | ❌ | ❌ |
| Gluestack & Tokens | ✅ **Owner** | ❌ | ❌ | ❌ |
| Screen-local ViewModels | ✅ **Owner** | ❌ | ❌ | ❌ |
| Swagger Discovery & Queries | ❌ | ✅ **Owner** | ❌ | ❌ |
| `use{Screen}Screen.ts` Hook | ❌ | ❌ | ✅ **Owner** | ❌ |
| DTO-to-ViewModel Mappers | ❌ | ❌ | ✅ **Owner** | ❌ |
| Native SDK Wrappers | ❌ | ❌ | ✅ **Owner** | ❌ |
| Security Audits & Remediation | ❌ | ❌ | ❌ | ✅ **Owner** |

---

## 🚀 Quick Start & CLI Tools

### 1. Validate Integration Boundaries
Scan files to ensure components do not contain direct network calls or unhandled error states:

```bash
# Validate all screen hooks
node agents/integration-agent/integration-agent.js validate ./src/screens

# Validate service wrappers
node agents/integration-agent/integration-agent.js validate ./src/services
```

### 2. Scaffold Screen Hook
Generate a clean coordinator hook skeleton:

```bash
node agents/integration-agent/integration-agent.js scaffold hook PlayerProfile --stack Main
```

---

## 💡 Real-World Example & Walkthrough

### Scenario: Connecting PlayerProfileScreen to Player Queries

#### Step 1: User Input
```markdown
Task: "Connect PlayerProfileScreen to usePlayerProfileQuery and usePlayerMatchesInfiniteQuery. 
Handle pull-to-refresh, infinite scroll, and empty states."
```

#### Step 2: Integration Agent Workflow
1. Inspects `src/screens/Main/PlayerProfileScreen/types.ts` for expected `PlayerProfileProps`.
2. Inspects `src/hooks/queries/usePlayerProfileQuery.ts` and `src/hooks/queries/usePlayerMatchesInfiniteQuery.ts`.
3. Creates `src/utils/playerProfileMapper.ts` to transform server DTOs into the UI view model:
   ```typescript
   import type { PlayerProfileResponse, PlayerMatchItem } from 'types';
   import type { PlayerProfileViewModel } from '../screens/Main/PlayerProfileScreen/types';

   export function mapPlayerProfileToViewModel(
     dto?: PlayerProfileResponse,
     matches?: PlayerMatchItem[]
   ): PlayerProfileViewModel {
     return {
       player: {
         id: dto?.id ?? '',
         name: dto?.username ?? '',
         avatarUrl: dto?.avatarUrl ?? '',
         rank: dto?.rank ?? 'Rookie',
       },
       stats: {
         winRate: dto?.stats ? `${(dto.stats.winRate * 100).toFixed(1)}%` : '0%',
         totalGames: dto?.stats?.totalGames ?? 0,
         mvpCount: dto?.stats?.mvpCount ?? 0,
       },
       recentMatches: matches?.map(m => ({
         id: m.id,
         opponent: m.opponentName,
         score: `${m.teamScore} - ${m.opponentScore}`,
         isWin: m.isWin,
       })) ?? [],
     };
   }
   ```
4. Implements `src/screens/Main/PlayerProfileScreen/usePlayerProfileScreen.ts`:
   ```typescript
   import { usePlayerProfileQuery, usePlayerMatchesInfiniteQuery } from 'hooks';
   import { mapPlayerProfileToViewModel } from 'utils/playerProfileMapper';

   export function usePlayerProfileScreen(playerId: string) {
     const profileQuery = usePlayerProfileQuery({ playerId });
     const matchesQuery = usePlayerMatchesInfiniteQuery({ playerId });

     const viewModel = mapPlayerProfileToViewModel(
       profileQuery.data,
       matchesQuery.data?.pages.flatMap(p => p.items)
     );

     return {
       viewModel,
       isLoading: profileQuery.isLoading || matchesQuery.isLoading,
       isError: profileQuery.isError || matchesQuery.isError,
       isRefreshing: profileQuery.isRefetching || matchesQuery.isRefetching,
       onRefresh: () => {
         profileQuery.refetch();
         matchesQuery.refetch();
       },
       onEndReached: () => {
         if (matchesQuery.hasNextPage && !matchesQuery.isFetchingNextPage) {
           matchesQuery.fetchNextPage();
         }
       },
     };
   }
   ```
5. Executes `npx tsc --noEmit` to verify type safety across both layers.

#### Step 3: Generated Integration Handoff Contract
```markdown
## Integration Handoff
status: completed
screen: PlayerProfileScreen
screenFile: src/screens/Main/PlayerProfileScreen/PlayerProfileScreen.tsx
hookFile: src/screens/Main/PlayerProfileScreen/usePlayerProfileScreen.ts
mapperFile: src/utils/playerProfileMapper.ts
wiredQueries:
  - usePlayerProfileQuery
  - usePlayerMatchesInfiniteQuery
wiredMutations: []
nativeModules: none
notes: "DTO mapped cleanly to ViewModel. Infinite list and pull-to-refresh fully wired."
```

---

## 🛠️ Exporting as a Standalone Git Repository

This `integration-agent` directory is completely self-contained. To publish it as a standalone repository:

```bash
cd agents/integration-agent
git init
git add .
git commit -m "feat: initial integration-agent release"
git remote add origin <YOUR_GIT_REPO_URL>
git push -u origin main
```
