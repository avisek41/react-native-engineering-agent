# React Native Agents

A collection of specialized AI engineering agents for React Native application development.

## Agents

| Agent | Use For | Path |
|---|---|---|
| **UI Agent** | Screens, components, layouts, design tokens, Figma translation | `agents/ui-agent/` |
| **API Agent** | OpenAPI/Swagger contracts, React Query hooks, mutations, API types | `agents/api-agent/` |
| **Integration Agent** | Screen coordinator hooks, DTO mappers, native modules, SDKs | `agents/integration-agent/` |
| **Security Agent** | OWASP MASVS compliance, secure storage, secret detection, audits | `agents/security-agent/` |

---

## Which Agent Should I Use?

- **UI & Layout work** → `agents/ui-agent/`
- **Backend / API work** → `agents/api-agent/`
- **Data-Wiring & Native SDKs** → `agents/integration-agent/`
- **Security & Compliance work** → `agents/security-agent/`

> If a task crosses multiple areas, use multiple agents in sequence (e.g., UI Agent → API Agent → Integration Agent). For details on picking the right agent, see [docs/agent-selection.md](docs/agent-selection.md).

---

## How To Use

### 1. Clone this repository

```bash
git clone https://github.com/avisek41/react-native-engineering-agent.git
```

### 2. Open the agent you need

Navigate to the agent directory:

```bash
cd agents/ui-agent/           # for UI work
cd agents/api-agent/          # for API work
cd agents/integration-agent/  # for data wiring & native modules
cd agents/security-agent/     # for security & audits
```

### 3. Provide to your AI coding assistant

Provide the agent instructions (`agent.md`), skills, or rules to your AI coding assistant together with your React Native project.

---

## Example Workflow

**Task:** *"Create a new profile screen and connect it to the profile API."*

1. **Step 1 — UI Agent**: Scaffold and implement the presentational UI screen from designs. The UI Agent emits a `UI Handoff` contract.
2. **Step 2 — API Agent**: Inspect OpenAPI specs, discover existing services, generate TanStack Query hooks, and emit an `API Handoff` contract.
3. **Step 3 — Integration Agent**: Generate the screen coordinator hook (`useProfileScreen.ts`) and DTO mapper to wire queries to the UI view model.


## 🔁 Closed-Loop Engineering Base

Every agent in this repository is architected around **Closed-Loop Engineering** principles. Rather than generating unverified code or relying solely on single-shot completions, each agent executes an in-loop validation cycle that iteratively verifies code against compiler gates, strict lint rules, and security analyzers before declaring a task complete:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ 1. UI Agent     │ ────▶ │ 2. API Agent    │ ────▶ │ 3. Integration  │ ────▶ │ 4. Security     │
│ (Figma ➔ UI)    │       │ (OpenAPI ➔      │       │    Agent        │       │    Agent        │
│                 │       │  Queries/Types) │       │ (Wires UI ➔     │       │ (Audits &       │
│  Closed-Loop:   │       │  Closed-Loop:   │       │  API + Native)  │       │  Auto-Fixes     │
│  Tokens + TSC   │       │  Swagger + TSC  │       │  Closed-Loop:   │       │  with Rollback) │
│  Convergence    │       │  Convergence    │       │  States + TSC   │       │  Zero Regress.  │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │ (UI Handoff)            │ (API Handoff)           │ (Integ. Handoff)        │
         └─────────────────────────┴─────────────────────────┴─────────────────────────┘
                                                                           ▼
                                                                Production Ready Code
```

### In-Loop Verification Gates per Agent

| Agent | In-Loop Self-Verification Checks | Closed-Loop Gate |
|---|---|---|
| **🎨 UI Agent** | • Zero hardcoded hex colors / magic strings (`COLORS.*`, `STRINGS.*`)<br>• Gluestack primitive enforcement & responsive layout checks<br>• Local ViewModel contract validation | `npx tsc --noEmit`<br>`node ui-agent.js validate` |
| **🔌 API Agent** | • 100% parameter and response schema match with Swagger/OpenAPI<br>• Zero-import pure TypeScript interfaces (`src/types/*.types.ts`)<br>• Re-export verification in `types/index.ts` and `hooks/index.ts` | `npx tsc --noEmit`<br>`node api-agent.js validate` |
| **🔄 Integration Agent** | • Zero direct HTTP/API calls inside JSX components<br>• Complete state mapping: `isLoading`, `isError`, `isRefreshing`, `isEmpty`<br>• Pagination & pull-to-refresh lifecycle verification | `npx tsc --noEmit`<br>`node integration-agent.js validate` |
| **🛡️ Security Agent** | • Static multi-level analysis (root, folder, file) across 8 domain packs<br>• Heuristic false-positive suppression (skips comments, test mocks, `__DEV__`)<br>• Safe auto-remediation with automatic rollback on compile failure | `security-agent.js`<br>`security-agent-ai.js --fix` |

---

## Supported AI Coding Agents


These agents are designed to work seamlessly with:

- **Antigravity**
- **Cursor**
- **Claude Code**
- **GitHub Copilot**
- **Codex / LLM CLI Tools**

The agent instructions are intentionally modular and tool-agnostic.

---

## Repository Structure

```
react-native-agents/
├── README.md                 # Main entry point & documentation
├── LICENSE                   # Open source license
├── CONTRIBUTING.md           # Guidelines for contributing new agents/rules
├── CHANGELOG.md              # Release history and updates
├── .gitignore                # Git ignore patterns
│
├── agents/
│   ├── ui-agent/             # Figma-to-code, Gluestack, components & screens
│   ├── api-agent/            # Swagger discovery, TanStack Query & API types
│   ├── integration-agent/    # Coordinator hooks, mappers & native SDKs
│   └── security-agent/       # Static security analyzer, MASVS & remediation
│
└── docs/
    ├── getting-started.md    # Quickstart guide
    ├── agent-selection.md    # Detailed guide on choosing the right agent
    └── usage.md              # Multi-agent workflows & IDE setups
```


Each agent contains its own instructions, skills, prompts, and supporting CLI tools.

---

## Documentation

- [Getting Started Guide](docs/getting-started.md)
- [Agent Selection Guide](docs/agent-selection.md)
- [Multi-Agent Usage & Workflows](docs/usage.md)

---

## Contributing

To add or modify an agent, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
