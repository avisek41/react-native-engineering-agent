# Agent Usage & Workflows

This document outlines how to invoke and compose the specialized React Native agents in real-world scenarios.

---

## 1. Using with AI Assistants

### Antigravity & Cursor
- Place the rules (`rules/*.mdc`) in your project's `.cursor/rules/` or `.agents/rules/` directory.
- Reference the agent file (`agents/{agent-name}/agent.md`) directly in prompts or chat context.

### Claude Code & Terminal Agents
- Start your prompt with the contents of `agent.md`:
```bash
cat agents/ui-agent/agent.md | claude "Scaffold the Settings screen based on the following Figma specs..."
```

### GitHub Copilot
- Include `agent.md` as context in Copilot Chat (`#file:agents/api-agent/agent.md`).

---

## 2. Multi-Agent Sequential Workflow

When building a full end-to-end feature:

### Step 1: UI Agent (Presentational Layer)
```
Input: Figma design link / wireframe requirements
Agent: agents/ui-agent/agent.md
Output: Screen (.tsx), Components, Theme tokens, Strings, and UI Handoff Contract
```

**UI Handoff Contract:**
```markdown
## UI Handoff
status: created
screenFile: src/screens/Main/ProfileScreen/ProfileScreen.tsx
viewModel: ProfileScreenProps (avatar, name, email, stats)
requiredApiData:
  - GET /user/profile
placeholders: none
```

---

### Step 2: API Agent (Contract & Query Layer)
```
Input: OpenAPI / Swagger documentation + UI Handoff Contract
Agent: agents/api-agent/agent.md
Output: Endpoint constant, Types, API fetcher, React Query hook, and API Handoff Contract
```

**API Handoff Contract:**
```markdown
## API Handoff
status: created
endpoint: user/profile
method: GET
files:
  - src/api/endPoints.ts
  - src/types/userProfile.types.ts
  - src/api/userProfile.api.ts
  - src/hooks/queries/useUserProfileQuery.ts
hook: useUserProfileQuery
```

---

### Step 3: Integration Agent (Coordinator Hook & Mappers)
```
Input: UI Handoff Contract + API Handoff Contract
Agent: agents/integration-agent/agent.md
Output: Coordinator hook (useProfileScreen.ts), DTO mapper, pagination, and Integration Handoff Contract
```

**Integration Handoff Contract:**
```markdown
## Integration Handoff
status: completed
screen: ProfileScreen
hookFile: src/screens/Main/ProfileScreen/useProfileScreen.ts
mapperFile: src/utils/profileMapper.ts
wiredQueries:
  - useUserProfileQuery
wiredMutations: []
nativeModules: none
notes: "All view models wired cleanly. Zero JSX networking."
```

---

### Step 4: Security Agent (Audit & Hardening)
```
Input: Codebase or modified files
Agent: agents/security-agent/agent.md
Output: Security report, automated fixes, compliance rating
```

Run before opening a PR:
```bash
node agents/security-agent/security-agent.js ./src --format=sarif --fail-on=high
```

