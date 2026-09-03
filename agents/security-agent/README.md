# Universal App Security Scanner v3

> **Architecture Philosophy**: Built on **Closed-Loop Engineering** principles. Features a deterministic 4-phase audit cycle (Detect ➔ Analyze ➔ Triage ➔ Remediate) with automated safe fixes and compile-check rollback to eliminate regression risks.

A config-driven, enterprise-grade static security analyzer for React Native (and

JS/TS) apps. Scans at **three distinct levels** — root, folder, and file — each
with the right rule set for that scope. Produces reports in HTML, Markdown, JSON,
and SARIF.

## Quick Start

```bash
# Full project scan
node security-agent/security-agent.js ./src

# Folder scan — only that domain's checks (no false "missing root detection")
node security-agent/security-agent.js ./src/navigation

# Single file — per-file rules only
node security-agent/security-agent.js ./src/services/authService.ts
```

## Configuration

Create a `security-agent.config.json` in your project root (optional — all
settings have sensible defaults):

```json
{
  "appName": "MyApp",
  "appType": "sports",
  "defaultFormat": "html",
  "defaultSeverity": "all",
  "excludePaths": ["**/*.test.ts", "**/__mocks__/**"],
  "customDomainRules": { "hooks": { "rules": [], "inverseChecks": [] } },
  "suppressions": [
    { "ruleId": "NET-003", "filePath": "src/services/healthCheck.ts" }
  ],
  "complianceFrameworks": ["OWASP-MASVS"],
  "failOn": "critical",
  "historyDir": "./security-agent-report"
}
```

See `security-agent.config.example.json` for all supported fields.

### App Name Resolution

The scanner resolves the app name in this priority order:
1. `--app-name` CLI flag
2. `appName` in `security-agent.config.json`
3. `name` field in the target project's `package.json`
4. `path.basename(targetDir)` (fallback)

## Scan Modes (auto-detected — no flag needed)

| Mode | Triggered by | What runs |
|---|---|---|
| **root** | `.`, `./src`, or any dir with a `package.json` | All core per-file rules + **every** domain's per-file rules + **all** platform-wide inverse checks + each domain's own inverse checks + dependency/npm audit |
| **folder** | A recognized feature folder (`services`, `navigation`, `screens`, `components`, `store`, `api`, `context`, `configs`, etc.) | Core per-file rules + that folder's **domain-specific rule pack** + that domain's own inverse checks only. Platform-wide checks are **not** run. |
| **file** | A single file path | Core per-file rules + the domain pack inferred from the parent folder. **No** inverse checks. |

Override with `--scope=root|folder|file` if auto-detection guesses wrong.

## CLI Options

```
Identity & Configuration:
  --app-name=<name>        Override resolved app name
  --app-type=<type>        e.g. sports, finance (default: from config or 'general')

Output Options:
  --format=html|md|json|sarif  Output format (default: html)
  --output=<path>              Output file path
  --severity=all|high|critical Minimum severity to report

CI/CD Options:
  --fail-on=critical|high|medium   Exit non-zero if findings at/above threshold
  --baseline=<path>                Path to previous JSON report; only fail on NEW findings
  --quiet                          Suppress console output (machine-readable only)

History & Trend:
  --history-dir=<path>     Append run stats to a JSONL file for trend tracking

Scan Control:
  --scope=root|folder|file Force a scan scope instead of auto-detect
  --skip-deps              Skip dependency vulnerability check
  --no-open                Don't auto-open HTML report
  --help, -h               Show this help
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Security Scan
  run: |
    node security-agent/security-agent.js ./src \
      --format=sarif \
      --fail-on=high \
      --quiet

- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: security-agent-report/security-report.sarif
```

### Baseline Diffing (prevent blocking on pre-existing debt)

```bash
# First run: save baseline
node security-agent/security-agent.js ./src --format=json --output=baseline.json

# Subsequent runs: only fail on NEW findings
node security-agent/security-agent.js ./src --format=json --baseline=baseline.json --fail-on=high
```

### Historical Trend Tracking

```bash
# Each scan appends to scan-history.jsonl
node security-agent/security-agent.js ./src --history-dir=./security-agent-report

# The HTML report shows a score trend chart from this data
node security-agent/security-agent.js ./src --history-dir=./security-agent-report --format=html
```

## Multi-Target / Monorepo

```bash
# Scan multiple targets — each gets its own report
node security-agent/security-agent.js ./app-a ./app-b --format=json
```

## Domain-Specific Rule Packs

Each recognized folder gets targeted checks on top of the universal core rules:

- **navigation/** — unvalidated deep link handlers, dynamic `navigate()` calls, sensitive screens reachable via deep link, missing auth guard
- **services/** — token refresh without concurrency lock, missing retry/backoff, missing cert-pinning hook
- **screens/** — sensitive `TextInput` without `secureTextEntry`, payment screens without screenshot protection
- **components/** — WebView `javaScriptEnabled` without origin whitelist, `eval()` on WebView `onMessage` data
- **store/** — `persist()` writing tokens without encrypted storage adapter, Redux DevTools in production
- **api/** — axios instance without enforced `baseURL`, request interceptor without expiry checks
- **context/** — token state in Context without secure-storage source of truth
- **configs/** — inline SDK secrets, security-bypass feature flags

## Compliance

Enable compliance framework mapping in your config:

```json
{ "complianceFrameworks": ["OWASP-MASVS", "GDPR"] }
```

Each finding will include `complianceRefs` (e.g. `["OWASP-MASVS MASVS-STORAGE-1"]`).

## Report Formats

| Format | Extension | Use Case |
|--------|-----------|----------|
| HTML | `.html` | Human review, stakeholder sharing, executive summary |
| Markdown | `.md` | PR comments, documentation |
| JSON | `.json` | CI pipelines, dashboard ingestion, baseline diffing |
| SARIF | `.sarif` | GitHub Code Scanning, enterprise security dashboards |

## File Layout

```
security-agent/
├── security-agent.js                   # CLI entry point — arg parsing, orchestration
├── security-agent.config.example.json  # Reference config with all fields
├── CHANGELOG.md                        # Version history
├── README.md                           # This file
├── lib/
│   ├── config.js          # Config file loading, CLI flag merging, identity resolution
│   ├── constants.js       # Severity levels, categories, folder taxonomy, compliance map
│   ├── scope.js           # Detects root vs folder vs file + domain
│   ├── rules-core.js      # Universal per-file rules (secrets, storage, network, logging, auth, general)
│   ├── rules-domain.js    # Per-folder rule packs (navigation, services, screens, etc.)
│   ├── rules-platform.js  # ROOT-ONLY platform-wide inverse checks
│   ├── scanner.js         # File walking, rule application, inverse-check dispatch, suppressions
│   ├── deps.js            # npm audit / known-issue dependency check (root scope only)
│   └── report.js          # HTML / Markdown / JSON / SARIF report generators
```

## Extending

### Add a New Folder Domain

1. Add an entry to `FOLDER_DOMAINS` in `lib/constants.js`
2. Add a `domainName: { rules: [...], inverseChecks: [...] }` block to `DOMAIN_PACKS` in `lib/rules-domain.js`

Or use `customDomainRules` in your config file to add project-specific domains without editing source.

### Add Compliance Mappings

Add your framework to `COMPLIANCE_MAP` in `lib/constants.js`:

```js
'PCI-DSS': {
  'SEC-001': ['Req.3.4'],
  'NET-001': ['Req.4.1'],
  // ...
}
```

## Agent Mode (Contextual Analysis)

The **Security Agent** wraps the existing scanner with deterministic local analysis
to provide contextual explanations, false-positive detection, priority scoring, and
fix suggestions — all without an LLM, API key, or network access.

### How It Differs from the Scanner

| Feature | Scanner (`security-agent.js`) | Agent (`security-agent-ai.js`) |
|---------|------|-------|
| Detection | Regex pattern matching | Same (reuses scanner) |
| Context | Line-level | ±15 lines + imports + file purpose |
| False positives | Reports everything | 8 heuristics to flag likely FPs |
| Explanations | Generic rule name | Plain-English impact explanation |
| Fix suggestions | Text recommendation | Before/after code diffs |
| Priority | Severity label only | Composite score (0-100) |
| Correlation | None | Cross-finding relationship detection |
| Auto-fix | None | Safe deterministic fixes with rollback |
| Interactive | None | Walk-through review mode |
| Dependencies | None | None (zero new dependencies) |

### Quick Start

```bash
# Full agent scan
npm run security:agent

# Quick mode — critical/high findings only
npm run security:agent:quick

# Auto-fix safe issues
npm run security:agent:fix

# Interactive review
npm run security:agent:interactive
```

---

## 🛡️ Core Rules & Invariants

1. **Zero Hardcoded Secrets**: No API keys, JWT secrets, AWS tokens, private keys, or passwords embedded in source code (extract to secure config).
2. **Encrypted Auth Storage**: Auth tokens, refresh tokens, biometric keys, and PII must strictly use `react-native-keychain` or encrypted storage (never plain `AsyncStorage` / `MMKV`).
3. **Enforced HTTPS / TLS**: All API client endpoints, WebViews, and image resources must use `https://` (no plaintext `http://`).
4. **Guarded Deep Links**: All deep links routing to sensitive screens must sanitize input parameters and verify session auth guards before dispatching navigation.
5. **Restricted WebViews**: WebViews must enforce origin domain whitelisting, sanitize `onMessage` payloads, and block direct `eval()` or unconstrained JavaScript bridges.
6. **Screen Capture Protection**: Payment, checkout, KYC, and biometric screens must enable screenshot and screen-recording prevention.
7. **Safe Auto-Fix with Rollback**: Automated fixes (`--fix`) are only applied if deterministic and must automatically roll back if TypeScript compilation fails.
8. **OWASP MASVS Mapping**: Every vulnerability finding must be categorized and linked to standard MASVS controls (Storage, Network, Auth, Cryptography).

---

## 💡 Real-World Example & Walkthrough


### Scenario: Auditing Auth Services & Deep Links

#### Step 1: User Input / CI Trigger
```markdown
Command: node agents/security-agent/security-agent-ai.js ./src/services ./src/navigation
Requirement: "Check for unencrypted token storage, plain-text network URLs, and unguarded deep links."
```

#### Step 2: Agent Execution & Triage
1. Evaluates all universal core rules and navigation/services domain rules.
2. Identifies vulnerabilities:
   - **SEC-002 (Critical):** `AsyncStorage.setItem('access_token', token)` in `authService.ts`.
   - **NET-001 (High):** `http://api.staging.mysports.com` in `configs/baseURL.ts`.
   - **NAV-001 (Medium):** Unvalidated deep link redirection in `navigation/linking.ts`.
3. Filters false positives (e.g. non-sensitive storage keys like `theme_preference` or test mock tokens).
4. Generates HTML & Markdown triage report.

#### Step 3: Automated Fix & Handoff Contract
```markdown
## Security Handoff
status: remediated
targetScanned: src/services, src/navigation
findings:
  critical: 1 (remediated)
  high: 1 (remediated)
  medium: 1 (remediated)
  low: 0
remediatedFiles:
  - src/services/authService.ts (switched to react-native-keychain)
  - src/configs/baseURL.ts (enforced HTTPS)
  - src/navigation/linking.ts (added auth session verification)
complianceFrameworks:
  - OWASP-MASVS
notes: "All high/critical items resolved. Passed regression scan."
```

---


### CLI Usage

```bash
node security-agent/security-agent-ai.js [target...] [options]
```

**Modes:**

| Flag | Description |
|------|-------------|
| *(default)* | Full 4-phase pipeline: Detect → Analyze → Triage → Report |
| `--quick` | Focus on critical/high-severity, high-confidence findings |
| `--fix` | Apply safe automatic fixes (deterministic, validated, rollback on failure) |
| `--interactive` | Walk through findings one-by-one with fix/skip/suppress/quit |
| `--format=md\|json` | Output format (default: md) |

**All existing scanner flags are also supported** (`--app-name`, `--scope`, `--fail-on`, etc.).

### Priority Scoring

Each finding receives a priority score (0-100) calculated as:

```
priority = severity × exploitability × reachability × impact × correlation
```

**Priority buckets:**

| Bucket | Score | Meaning |
|--------|-------|---------|
| 🔥 Fix Immediately | ≥ 80 | Exploitable, production-reachable, high impact |
| ⚡ Fix This Sprint | 50-79 | Real issue, moderate exposure |
| 📋 Backlog | 20-49 | Defense-in-depth, best practice |
| ℹ️  Informational | < 20 | Awareness only |

> **Note:** Priority scores are heuristic-based and help focus remediation effort.
> They are not proven security metrics.

### False Positive Detection

The agent uses 8 conservative heuristics:

1. Finding is inside a comment or JSDoc
2. Finding is in a test/spec/mock file
3. Finding is in a `.d.ts` or type/interface definition
4. Finding is guarded by `if (__DEV__)`
5. Value is an environment/config reference, not a hardcoded secret
6. Value is a placeholder, label, or non-sensitive constant
7. Console logging is stripped by babel-plugin-transform-remove-console
8. Finding is on an import statement

Findings are classified as: `confirmed`, `likely`, `uncertain`, or `likely_false_positive`.

Likely false positives are **never silently suppressed** — they appear in a dedicated
section of the report for transparency.

### Safe Auto-Fix

The `--fix` flag only applies fixes that are:

- **Deterministic** — exact string replacement with known outcome
- **Low-risk** — e.g. `http://` → `https://`, `rejectUnauthorized: false` → `true`
- **Validated** — source text verified, balanced braces checked, atomic write
- **Rollback-safe** — backup created, reverted if TypeScript validation fails

Fixes that require architectural changes (token storage, auth flows, etc.) are
**never auto-applied** — they appear as suggested diffs in the report.

### Limitations

- Analysis is deterministic (regex + heuristic), not AI/LLM-powered
- No full AST or interprocedural data-flow analysis
- Priority scores are heuristic, not proven security metrics
- Cross-file correlation is evidence-based, not speculative
- Cannot guarantee complete vulnerability detection

### JSON Output (CI Integration)

```bash
node security-agent/security-agent-ai.js ./src --format=json --quiet
```

Produces a JSON report with schema:

```json
{
  "version": "1.0.0",
  "scan": { "appName": "", "scope": {}, "timestamp": "", "filesScanned": 0 },
  "summary": { "total": 0, "confirmed": 0, "likely": 0, "uncertain": 0, "likelyFalsePositives": 0, "bySeverity": {} },
  "priority": { "distribution": {}, "topActions": [] },
  "findings": [{ "rule": "", "severity": "", "context": {}, "priority": {}, "fix": {} }],
  "fixes": { "autoFixable": [], "manualOnly": [] }
}
```

