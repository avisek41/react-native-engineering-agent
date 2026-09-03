# React Native Agents

A collection of specialized AI engineering agents for React Native application development.

## Agents

| Agent | Use For | Path |
|---|---|---|
| **UI Agent** | Screens, components, layouts, design tokens, Figma translation | `agents/ui-agent/` |
| **API Agent** | OpenAPI/Swagger contracts, React Query hooks, mutations, API types | `agents/api-agent/` |
| **Security Agent** | OWASP MASVS compliance, secure storage, secret detection, audits | `agents/security-agent/` |

---

## Which Agent Should I Use?

- **UI & Layout work** → `agents/ui-agent/`
- **Backend / API work** → `agents/api-agent/`
- **Security & Compliance work** → `agents/security-agent/`

> If a task crosses multiple areas, use multiple agents in sequence (e.g., UI Agent followed by API Agent). For details on picking the right agent, see [docs/agent-selection.md](docs/agent-selection.md).

---

## How To Use

### 1. Clone this repository

```bash
git clone https://github.com/avisek41/react-native-engineering-agent.git
```

### 2. Open the agent you need

Navigate to the agent directory:

```bash
cd agents/ui-agent/        # for UI work
cd agents/api-agent/       # for API work
cd agents/security-agent/  # for security & audits
```

### 3. Provide to your AI coding assistant

Provide the agent instructions (`agent.md`), skills, or rules to your AI coding assistant together with your React Native project.

---

## Example Workflow

**Task:** *"Create a new profile screen and connect it to the profile API."*

1. **Step 1 — UI Agent**: Scaffold and implement the presentational UI screen from designs. The UI Agent emits a `UI Handoff` contract.
2. **Step 2 — API Agent**: Inspect OpenAPI specs, discover existing services, generate TanStack Query hooks, and emit an `API Handoff` contract.

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
