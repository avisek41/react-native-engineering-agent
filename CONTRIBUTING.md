# Contributing to React Native Agents

Thank you for your interest in contributing! We welcome contributions to improve existing agents, add new domain rules, or add new specialized agents.

---

## 1. Agent Architecture Standards

Each agent inside `agents/` must adhere to the standard agent layout:

```
agents/<agent-name>/
├── agent.md                        # Master system prompt with YAML frontmatter
├── README.md                       # Documentation & CLI usage
├── <AGENT>_ARCHITECTURE.md         # Architectural constraints and invariants
├── commands/                       # Cursor / assistant slash commands
├── skills/                         # Procedural skills with SKILL.md
├── rules/                          # Strict .mdc engineering rules
└── templates/                      # Boilerplate templates
```

---

## 2. Guidelines for Changes

1. **Strict Separation of Concerns**: Agents must have distinct boundaries. UI agents do not touch networking; API agents do not touch JSX; Security agents focus on audits and vulnerability mitigation.
2. **Tool Agnostic**: Instructions and skills must work across modern AI tools (Antigravity, Cursor, Claude Code, Copilot, Codex).
3. **Deterministic Testing**: Any CLI scripts or static validators must have clean error codes and zero external runtime dependencies where possible.

---

## 3. Submitting Changes

1. Fork the repository.
2. Create a feature branch: `git checkout -b feat/my-agent-improvement`.
3. Commit your changes: `git commit -m "feat(ui-agent): add new layout skill"`.
4. Push to your branch and open a Pull Request.
