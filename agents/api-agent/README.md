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

## 📋 API Handoff Contract

Every API Agent task concludes with an **API Handoff** block:

```markdown
## API Handoff
status: created | reused | none
endpoint: mobile/programs/:programId/teams
method: GET
skipAuth: false
paging: page/limit
files:
  - src/api/endPoints.ts
  - src/types/programTeams.types.ts
  - src/types/index.ts
  - src/api/programTeams.api.ts
  - src/hooks/queries/useProgramTeamsInfiniteQuery.ts
  - src/hooks/index.ts
hook: useProgramTeamsInfiniteQuery
queryKeys: programTeamsKeys
itemType: ProgramTeamsItem
unmatchedSwagger: []
blockedOn: none
notes: "Reused existing types where applicable; added new infinite query hook."
```
