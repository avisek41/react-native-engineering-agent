# Getting Started with React Native Agents

This guide explains how to set up and start using the specialized React Native AI agents in your development workflow.

---

## 1. Prerequisites

- **Node.js**: >= 18.0.0
- **A React Native Project**: React Native (CLI) or Expo project
- **An AI Assistant**: Antigravity, Cursor, Claude Code, GitHub Copilot, or Codex

---

## 2. Installation & Setup

Clone this repository into your development machine or as a submodule within your project:

```bash
# Clone the repository
git clone https://github.com/avisek41/react-native-engineering-agent.git react-native-agents
```

---

## 3. Directory Layout

```
agents/
├── ui-agent/          # UI specialist (Figma, Gluestack, components, screens)
├── api-agent/         # API specialist (Swagger, TanStack Query, types)
├── integration-agent/ # Integration specialist (Screen hooks, mappers, native SDKs)
└── security-agent/    # Security specialist (Scanner, heuristic agent, MASVS)
```

Each agent directory contains:
- `agent.md`: The complete system prompt and behavioral constraints for the AI agent.
- `README.md`: In-depth documentation on the agent's capabilities, CLI tools, and architecture.
- `skills/`: Step-by-step procedural guidelines that the agent references during task execution.
- `rules/`: Strict engineering standards (e.g. `.mdc` rules for Cursor / Antigravity).

---

## 4. First Run

### UI Agent
Scaffold or validate presentational UI:
```bash
# Validate UI token compliance
node agents/ui-agent/ui-agent.js validate ./src/screens

# Scaffold a new screen
node agents/ui-agent/ui-agent.js scaffold screen ProfileScreen
```

### API Agent
Validate or scaffold TanStack queries:
```bash
# Validate API layers
node agents/api-agent/api-agent.js validate ./src/api

# Scaffold a query hook
node agents/api-agent/api-agent.js scaffold query --name=userProfile --endpoint=/user/profile
```

### Integration Agent
Scaffold screen hooks or validate separation of concerns:
```bash
# Validate separation of concerns
node agents/integration-agent/integration-agent.js validate ./src/screens

# Scaffold a coordinator hook
node agents/integration-agent/integration-agent.js scaffold hook PlayerProfile
```


### Security Agent
Run static security scans and automated remediation:
```bash
# Run full project security scan (HTML report)
node agents/security-agent/security-agent.js ./src

# Run contextual AI security agent
node agents/security-agent/security-agent-ai.js ./src
```
