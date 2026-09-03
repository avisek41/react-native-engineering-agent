# Agent Selection

Choosing the right agent ensures clean separation of concerns, eliminates redundant code, and keeps each engineering step focused.

---

## Quick Reference

| Agent | Directory | Use For |
|---|---|---|
| **UI Agent** | `agents/ui-agent/` | Screens, components, design tokens, layouts, Figma translation |
| **API Agent** | `agents/api-agent/` | OpenAPI/Swagger discovery, TanStack Query hooks, API types, endpoints |
| **Security Agent** | `agents/security-agent/` | Security audits, token storage, encryption, hardcoded secrets, MASVS |

---

## 🎨 UI Agent (`agents/ui-agent/`)

Use when the primary task involves React Native UI, layout, styling, or component design.

### Examples:
- Create a new screen from Figma or wireframes
- Build a reusable UI component / primitive (buttons, badges, cards)
- Implement a modal, bottom sheet, or drawer layout
- Fix styling, responsive layout, or visual bugs
- Enforce design tokens (spacing, typography, color palette)

### When NOT to use:
- Generating API fetchers or React Query hooks
- Connecting screens to backend endpoints

---

## 🔌 API Agent (`agents/api-agent/`)

Use when the primary task involves backend communication, OpenAPI discovery, or React Query data layer management.

### Examples:
- Inspect OpenAPI / Swagger specifications
- Add an API endpoint constant and API client function
- Implement a TanStack `useQuery` or `useInfiniteQuery` hook
- Implement a `useMutation` hook with optimistic updates
- Define zero-import TypeScript contract types (`src/types/*.types.ts`)
- Handle API response mapping and error payloads

### When NOT to use:
- Building screens, components, or JSX layouts
- Editing navigation stacks or theme colors

---

## 🛡️ Security Agent (`agents/security-agent/`)

Use when auditing code for vulnerabilities, implementing security-critical features, or performing compliance verification.

### Examples:
- Audit codebase for hardcoded secrets, tokens, or credentials
- Secure token storage with `react-native-keychain` / encrypted storage
- Harden network layer (enforce HTTPS, cert pinning)
- Audit WebViews for unrestricted JavaScript or origin validation
- Verify OWASP MASVS compliance
- Run automated security scans in CI/CD pipelines

---

## Multi-Agent Tasks

For complex tasks spanning multiple domains, chain the agents:

1. **New Feature Screen:** Run **UI Agent** first to build the presentational view → Run **API Agent** to generate the queries/mutations.
2. **Security Audit & Hardening:** Run **Security Agent** to scan findings → Apply recommended security fixes.
