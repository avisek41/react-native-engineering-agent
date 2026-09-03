# API Agent 🔌

An enterprise-grade, standalone API Implementation, Discovery, and Validation Agent for React Native and TanStack Query (`@tanstack/react-query`) applications.

The **API Agent** specializes in discovering OpenAPI / Swagger contracts, enforcing DRY reuse across the codebase, generating strictly-typed contracts and hooks, and performing static closed-loop verification — completely isolated from UI rendering.

---

## 📦 Directory Overview

```
api-agent/
├── agent.md                        # Cursor / AI Agent system prompt
├── README.md                       # Comprehensive agent documentation
├── API_AGENT_ARCHITECTURE.md       # Architecture, contracts, and boundary rules
├── package.json                    # Standalone package definition
├── api-agent.config.example.json   # Configuration example for static validator
├── api-agent.js                    # CLI tool for API validation & scaffolding
│
├── commands/                       # AI Agent / Cursor Commands
│   ├── api-hook.md                 # Complete API hook & type generator from spec
│   ├── discover-swagger.md         # OpenAPI contract inspection & reuse search
│   ├── generate-query.md           # Single item query generator
│   ├── generate-infinite-query.md  # Paginated list infinite query generator
│   ├── generate-mutation.md        # POST/PUT/PATCH/DELETE mutation generator
│   └── validate-api.md             # Closed-loop compiler & barrel validation
│
├── skills/                         # Agent Skills & Domain Guides
│   ├── api-implementation/
│   │   ├── SKILL.md                # Step-by-step API file generation protocol
│   │   └── reference.md            # Code templates for types, api, queries & mutations
│   ├── swagger-discovery/
│   │   └── SKILL.md                # OpenAPI/Swagger extraction & normalization
│   └── contract-validator/
│       └── SKILL.md                # Schema matching & contract verification guide
│
├── rules/                          # Strict Engineering Guidelines (.mdc)
│   ├── api-standards.mdc           # TanStack query rules, types, and apiRequest
│   ├── closed-loop-engineering.mdc # Self-verification & TSC gate convergence
│   ├── modern-js-ts-pattern.mdc    # TypeScript & modern JS paradigms
│   └── no-hardcoded-values.mdc     # Endpoint constants & string rules
│
├── templates/                      # Code Generation Blueprints
│   ├── types.template.ts           # Zero-import pure TypeScript interface
│   ├── api.template.ts             # `apiRequest` fetcher with logger
│   ├── query.template.ts           # TanStack `useQuery` template
│   ├── infiniteQuery.template.ts   # TanStack `useInfiniteQuery` template
│   └── mutation.template.ts        # TanStack `useMutation` template
│
└── lib/                            # Validation & Scaffolding Engine
    ├── constants.js                # Exit codes, regex patterns & rules
    ├── validator.js                # AST / regex static code analyzer
    ├── scaffolder.js               # CLI interactive code generator
    └── report.js                   # Output formatting (Terminal/JSON)
```

---

## 🚀 Quick Start & CLI Tools

### 1. Validate API Layer
Run the static validator across the API, hooks, and types layers:

```bash
# Validate entire API layer
node api-agent/api-agent.js validate ./src

# Validate only API endpoints & functions
node api-agent/api-agent.js validate ./src/api

# Validate only React Query hooks
node api-agent/api-agent.js validate ./src/hooks

# Validate types barrel & definitions
node api-agent/api-agent.js validate ./src/types
```

### 2. Scaffold New API Modules
Quickly generate boilerplate adhering to strict team standards:

```bash
# Generate single item query
node api-agent/api-agent.js scaffold query --name=userProfile --endpoint=/user/profile

# Generate paginated list infinite query
node api-agent/api-agent.js scaffold infinite --name=productsSearch --endpoint=/products/search

# Generate mutation (POST/PUT/PATCH/DELETE)
node api-agent/api-agent.js scaffold mutation --name=authLogin --endpoint=/auth/login --method=POST
```

---

## 🛡️ Core Rules & Invariants

1. **Pure Types**: Types live ONLY in `src/types/{camelName}.types.ts` with zero imports.
2. **Barrel Exports**: Always re-export types in `src/types/index.ts` and hooks in `src/hooks/index.ts`.
3. **No Inline Types**: API fetchers and hooks must import types strictly from `'types'`.
4. **Endpoint Constants**: All URL paths must be registered in `src/api/endPoints.ts` (SCREAMING_SNAKE_CASE).
5. **No Direct `fetch` or `axios`**: Always use `apiRequest` from `api/apiClient`.
6. **Query Keys as Functions**: Detail and list query keys must be factory functions returning `const` tuples.
7. **Infinite Query `select`**: Infinite queries must always provide a `select` mapper returning `{ items, total }`.
8. **Logging**: Use `logger` from `'utils'` inside `queryFn` and `mutationFn`.
9. **Never Touch UI**: No JSX, components, navigation, or screens.

---

## 💡 Real-World Example & Walkthrough

### Scenario: Adding Player Profile Query from Swagger

#### Step 1: User Input
```markdown
Swagger Doc: https://uat.futureonesports.com/api/docs-json
Operation: GET /mobile/players/{playerId}/profile
Requirement: "Generate the API request, TypeScript types, and React Query hook for the player profile endpoint."
```

#### Step 2: API Agent Execution
1. Extracts parameters (`playerId`), authorization mode (`Bearer`), and payload shape from Swagger JSON.
2. Checks existing codebase to ensure endpoint isn't already declared.
3. Generates zero-import types in `src/types/playerProfile.types.ts`:
   ```typescript
   export interface PlayerProfileResponse {
     id: string;
     username: string;
     email: string;
     rank: string;
     stats: { gamesPlayed: number; wins: number };
   }
   ```
4. Registers endpoint in `src/api/endPoints.ts`:
   ```typescript
   export const ENDPOINTS = {
     // ...
     PLAYER_PROFILE: 'mobile/players/:playerId/profile',
   } as const;
   ```
5. Creates API function in `src/api/playerProfile.api.ts` and TanStack Query hook in `src/hooks/queries/usePlayerProfileQuery.ts`.
6. Re-exports in barrels (`src/types/index.ts` and `src/hooks/index.ts`).
7. Executes static validation:
   ```bash
   node agents/api-agent/api-agent.js validate ./src/api
   ```

#### Step 3: Generated API Handoff Contract
```markdown
## API Handoff
status: created
endpoint: mobile/players/:playerId/profile
method: GET
skipAuth: false
paging: none
files:
  - src/api/endPoints.ts
  - src/types/playerProfile.types.ts
  - src/types/index.ts
  - src/api/playerProfile.api.ts
  - src/hooks/queries/usePlayerProfileQuery.ts
  - src/hooks/index.ts
hook: usePlayerProfileQuery
queryKeys: playerProfileKeys
itemType: PlayerProfileResponse
unmatchedSwagger: []
blockedOn: none
notes: "Zero-import types generated. Query key factory and hook ready for use."
```

