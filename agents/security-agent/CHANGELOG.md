# Changelog

## [3.0.0] — 2026-07-08

### Summary

Refactored the FutureOne-specific security scanner into a **Universal App Security Scanner** — a config-driven, CI/CD-ready CLI that any React Native or JS/TS project can adopt with zero hardcoded app identity.

### Breaking Changes

- **Tool name**: "FutureOne Security Agent" → "Universal App Security Scanner". All report titles, headers, footers, and CLI banners now use the resolved `appName` instead of hardcoded "FutureOne".
- **Default `appType`**: Changed from `'sports'` to `'general'` when no `--app-type` flag or config is provided. Existing usage with `--app-type=sports` is unaffected.
- **Exit code behavior**: When `--fail-on` is set, it replaces the legacy "exit 1 on critical" behavior. Without `--fail-on`, legacy behavior is preserved.

### Added

- **`lib/config.js`** — New config loader/merger. Resolves app identity with priority chain: `--app-name` > config file > `package.json` name > directory basename.
- **`security-agent.config.json` support** — Place a config file at your project root with `appName`, `appType`, `defaultFormat`, `defaultSeverity`, `excludePaths`, `customDomainRules`, `suppressions`, `complianceFrameworks`, `failOn`, and `historyDir`.
- **`--format=sarif`** — Hand-rolled SARIF v2.1.0 output for GitHub Code Scanning and enterprise security dashboards.
- **`--fail-on=critical|high|medium`** — Configurable exit-code threshold (replaces hardcoded "critical only" behavior).
- **`--baseline=<path>`** — Diff against a previous JSON report and only fail on *new* findings, preventing builds from breaking on pre-existing debt.
- **`--quiet`** — Suppress all console output for CI pipelines (only machine-readable report is written).
- **`--history-dir=<path>`** — Append run stats to a JSONL file (`scan-history.jsonl`) for trend tracking.
- **Multi-target scanning** — Pass multiple directories (`./app-a ./app-b`) to scan each independently with separate reports.
- **Universal JSON schema (v1.0)** — Versioned schema with `schemaVersion`, `appName`, `appType`, `scope`, `scanTimestamp`, `findings[]` (each with `id`, `severity`, `domain`, `file`, `line`, `rule`, `description`, `remediation`, `complianceRefs[]`), `stats`, `scoreInfo`.
- **Executive summary** in HTML reports — Top findings, score trend chart, sign-off callout for criticals, designed for non-engineering stakeholders.
- **Score trend chart** — Inline SVG sparkline in HTML report showing score over last N runs (requires `--history-dir`).
- **Compliance references** — OWASP-MASVS and GDPR mappings for all ~50 rules. Enable via `complianceFrameworks` in config.
- **Suppressions** — Rule-id + file path pairs to ignore known accepted risks.
- **Custom domain rules** — Extend `FOLDER_DOMAINS` per-project via config without editing source.
- **Deterministic finding IDs** — Each finding gets a stable SHA256-based ID for baseline diffing.
- **`security-agent.config.example.json`** — Reference config showing all supported fields.

### Changed

- **`lib/scope.js`** — `detectScanScope` now accepts an optional merged domains map (supports custom domains from config). No breaking changes to the three-mode detection logic.
- **`lib/scanner.js`** — `walkDir` respects `excludePaths`. `scanFile` merges custom domain rules. `makeFindingFactory` generates stable IDs and resolves compliance refs.
- **`lib/report.js`** — All generators accept `appName` parameter. JSON report uses universal schema v1.0. HTML report includes executive summary and trend chart.
- **`lib/deps.js`** — `checkDependencies` respects `quiet` mode.
- **`lib/constants.js`** — Added `COMPLIANCE_MAP` and `resolveComplianceRefs()`.

### Backward Compatibility

Running with no config file and the existing flags (`--format=html --app-type=sports`) behaves identically to v2, except the app name is resolved from `package.json` instead of being hardcoded as "FutureOne".
