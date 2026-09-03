# Changelog

All notable changes to the `react-native-engineering-agents` project will be documented in this file.

## [1.0.0] - 2026-09-03

### Added
- **UI Agent (`agents/ui-agent/`)**:
  - Full Figma-to-code translation protocol.
  - Gluestack UI & design token enforcement rules (`.mdc`).
  - Screen and component generators with CLI validation.
  - UI Handoff contract specification.
- **API Agent (`agents/api-agent/`)**:
  - OpenAPI/Swagger discovery and automated contract extraction.
  - TanStack Query (`@tanstack/react-query`) query/mutation scaffolding.
  - Pure TypeScript type contract generation and barrel export verification.
  - API Handoff contract specification.
- **Integration Agent (`agents/integration-agent/`)**:
  - Screen coordinator hook (`useXxxScreen.ts`) generator and boundaries.
  - DTO-to-ViewModel mapping guidelines and templates.
  - Third-party native SDK wrapping protocol (Firebase, Push, Deep Linking).
  - Integration Handoff contract specification.
- **Security Agent (`agents/security-agent/`)**:
  - Static multi-level security analyzer (root, folder, file).
  - Deterministic contextual AI analyzer with false-positive detection.
  - Safe automatic remediation mode (`--fix`).
  - OWASP MASVS compliance mapping and multi-format reporting (HTML, Markdown, JSON, SARIF).

- **Core Documentation**:
  - Comprehensive `README.md`, `docs/getting-started.md`, `docs/agent-selection.md`, and `docs/usage.md`.
