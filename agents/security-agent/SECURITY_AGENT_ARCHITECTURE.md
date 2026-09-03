# 🛡️ Architecture & Design Principles: Local Security Agent

**Author:** Engineering Team  
**System:** Security Agent for React Native & Mobile Client  
**Version:** 1.0.0 (Local Deterministic Analysis Engine)

---

## 📌 Executive Summary

The **Security Agent** is a purpose-built, offline, deterministic static security analyzer and triage agent designed specifically for React Native and JavaScript/TypeScript codebases.

Unlike traditional static linters (which only flag line-level regex hits) or cloud LLM tools (which leak source code, require paid API keys, and introduce non-deterministic results), this agent provides **context-aware security analysis, false-positive filtering, heuristic priority triage, and safe remediation guidance** with **zero external dependencies, zero API keys, and 100% offline execution.**

---

## 🔍 How It Scans (Scanning Mechanics & Flow)

The agent operates through an internal pipeline that bridges **multi-tier static discovery** with **contextual semantic verification**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 4-PHASE AGENT PIPELINE                                 │
│                                                                                        │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────┐     ┌──────────────┐   │
│   │ 1. DETECT     │ ──▶ │ 2. ANALYZE    │ ──▶ │ 3. TRIAGE     │ ──▶ │ 4. REPORT    │   │
│   │ Pattern & Scope│     │ Context & FP  │     │ Heuristic Risk│     │ Actionable   │   │
│   │ Discovery     │     │ Evaluation    │     │ Scoring (0-100│     │ Markdown/JSON│   │
│   └───────────────┘     └───────────────┘     └───────────────┘     └──────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Target Discovery & Traversal:**
   - Recursively walks source directories matching `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, and `.env` files.
   - Automatically skips non-production directories (`node_modules`, `android`, `ios`, `build`, `dist`, `coverage`, `__tests__`, `__mocks__`, `vendor`, `.bundle`).
2. **Scope Resolution:**
   - Automatically determines whether the scan target is **Root** (full app), a **Domain Folder** (`services`, `navigation`, `screens`, `store`, `api`, `context`, `configs`), or a **Single File**.
3. **Multi-Layer Rule Application:**
   - **Core Rules:** Evaluated on every single file across the codebase.
   - **Domain-Specific Rules:** Evaluated on files within specific architecture folders (e.g. WebView rules only applied to components, deep-link rules only to navigation).
   - **Platform Inverse Checks:** Evaluated across the entire aggregated codebase to detect missing security layers (e.g., lack of certificate pinning or root detection).
4. **Dependency Audit (`npm audit` & Known Package Vulnerabilities):**
   - Automatically parses `package.json` and lockfiles to detect vulnerable dependencies and known insecure versions.
5. **Contextual Analysis & Heuristic Filtering:**
   - Reads surrounding code ($\pm 15$ lines) around each finding to confirm if the match is inside executable code, guarded by `__DEV__`, in comments/types, or already using a safe wrapper.

---

## 📋 Exact Parameters & Security Checklist Evaluated

The agent validates the codebase against **12 major security domains** aligned with the **OWASP Mobile Application Security Verification Standard (MASVS)**:

### 1. 🔑 Hardcoded Secrets & Credentials (`SEC-*`)
- **API Keys & Tokens:** Hardcoded high-entropy tokens, JWTs, Bearer headers, and API keys.
- **Cloud & Third-Party Secrets:** AWS Access Keys (`AKIA...`), Firebase config secrets, private keys (`-----BEGIN PRIVATE KEY-----`).
- **Hardcoded Passwords / Private Credentials:** Inline plaintext credentials or encryption keys.
- **Embedded URLs:** URLs containing plaintext authentication (`http://user:password@host`).

### 2. 💾 Secure Storage & Token Persistence (`STR-*`, `STA-*`, `CTX-*`)
- **AsyncStorage Abuse:** Flagging sensitive tokens, passwords, or session data stored in plaintext `AsyncStorage`.
- **Encrypted Alternatives:** Verifying whether sensitive data uses `react-native-keychain`, `react-native-encrypted-storage`, or encrypted `MMKV`.
- **State Persistence:** Checking if Redux/Zustand `persist()` middleware writes unencrypted authentication state to disk.
- **Context Leaks:** Verifying `AuthContext` state uses secure persistent backing.

### 3. 🌐 Network & Transport Security (`NET-*`, `API-*`)
- **Cleartext Traffic:** Flagging unencrypted HTTP URLs (`http://`) and WebSockets (`ws://`) in production endpoints.
- **SSL Validation Bypass:** Detecting disabled TLS validation (`rejectUnauthorized: false` or `ssl_verify: false`).
- **Missing Timeouts:** Detecting bare `fetch()` or HTTP requests missing abort controllers / timeouts that could cause connection exhaustion.
- **Axios BaseURL Enforcement:** Ensuring axios instances enforce explicit base URLs to prevent arbitrary endpoint redirection.

### 4. 📝 Sensitive Data Logging (`LOG-*`)
- **Token & Credential Logging:** Detecting `console.log` / custom loggers printing access tokens, refresh tokens, passwords, or secrets.
- **Production Console Statements:** Detecting leftover debugging console outputs in production code paths.
- **Babel Strip Verification:** Checking if `babel-plugin-transform-remove-console` is configured to mitigate console exposure in production builds.

### 5. 🗺️ Navigation & Deep-Link Security (`NAV-*`)
- **Deep Link Validation:** Flagging `Linking.addEventListener('url', ...)` and `Linking.getInitialURL()` calls lacking input sanitization and route allowlists.
- **Dynamic Route Injection:** Detecting unvalidated dynamic variable navigation (`navigation.navigate(variableRoute)`).
- **Public Protected Routes:** Detecting sensitive screens (payments, checkout, settings) exposed to deep links without navigator-level authentication gates.

### 6. 🔐 Authentication & Session Lifecycle (`AUTH-*`, `SVC-*`)
- **Token Refresh Concurrency (Mutex):** Flagging token refresh calls without concurrency locks that cause 401 race-condition token invalidation.
- **Refresh Token Rotation:** Checking if token refresh handlers support single-use token rotation to prevent replay attacks.
- **Security Bypasses:** Detecting unverified `skipAuth: true` bypass flags.

### 7. 🧩 Component & WebView Security (`CMP-*`, `SCR-*`)
- **WebView JavaScript & Origin Whitelist:** Detecting `javaScriptEnabled={true}` coupled with wildcard `originWhitelist={['*']}`.
- **Remote Code Execution in WebViews:** Detecting `eval()` or `Function()` calls executing data from WebView `onMessage` handlers.
- **Sensitive Text Input Masking:** Ensuring password, PIN, and CVV fields specify `secureTextEntry={true}`.
- **Screen Capture Protection:** Checking that payment / financial screens utilize `FLAG_SECURE` / screen capture prevention.

### 8. 🛡️ Code Execution & Injection (`GEN-*`)
- **Dynamic Code Execution:** Detecting `eval()` and unsafe dynamic code evaluation.
- **Cross-Site Scripting (XSS):** Detecting un-sanitized `dangerouslySetInnerHTML` usage.
- **SQL Injection:** Detecting SQL queries constructed via raw string template literals rather than parameterized statements.
- **Insecure Randomness:** Detecting `Math.random()` used for token, session ID, or cryptographic generation.

### 9. ⚙️ Configuration & Feature Flags (`CFG-*`, `ENV-*`)
- **Security Bypass Flags:** Detecting hardcoded flags like `disableSSLPinning: true` or `bypassValidation: true`.
- **Committed `.env` Files:** Detecting committed `.env` files with active secrets not excluded by `.gitignore`.

### 10. 📱 Platform Hardening & Invariants (`PLAT-*`)
- **Certificate Pinning:** Verifying whether mobile API clients implement SSL Pinning / TrustKit.
- **Code Obfuscation:** Checking for ProGuard / R8 / Hermes bytecode configuration.
- **Root & Jailbreak Detection:** Checking for device tampering detection (`react-native-jail-monkey`, etc.).
- **Biometric Authentication:** Checking for hardware-backed biometric verification on sensitive flows.

---

## 🏛️ Core Design Principles

### 1. ⚡ Zero-Dependency & 100% Offline (Privacy by Design)
- **Zero Third-Party Packages Added:** Built strictly using native Node.js runtime (`fs`, `path`, `crypto`, `node:readline`).
- **Zero Network Egress:** No code, tokens, or telemetry leave the local developer machine or CI container.
- **Cost & Reliability:** Never breaks due to rate limits, API deprecations, or offline environments.

### 2. 🎯 Multi-Tier Scope Awareness (Root vs. Folder vs. File)
Static scanners often suffer from **scope misattribution** (e.g., flagging that a single UI component is missing root/jailbreak detection). The agent dynamically resolves its scope:
- **Root Mode (`./src`):** Evaluates app-wide platform hardening (obfuscation, certificate pinning, biometric hooks, root detection) + dependency vulnerabilities.
- **Folder Mode (`./src/navigation`, `./src/services`):** Evaluates domain-specific invariants (e.g., deep-link route validation in navigation; token mutex locks in services).
- **File Mode (`./src/api/apiClient.ts`):** Restricts checks strictly to local rules without triggering false missing-architecture alarms.

### 3. 🧠 Deterministic Context & False-Positive Elimination
Traditional scanners alert on any keyword match. The agent's `context-analyzer.js` inspects $\pm15$ lines of surrounding code and applies 8 conservative heuristics:
- **`__DEV__` Guards:** Gated debugging or verbose logs are downgraded/cleared.
- **Comment / Type Exclusions:** Ignores TypeScript interface definitions (`.d.ts`), comments, or JSDoc.
- **Mock & Test Isolation:** Automatically recognizes test fixtures, spec files, and mocks.
- **Environment & Config References:** Differentiates between hardcoded secrets and `Config.API_KEY` or `process.env.*` reads.
- **Placeholders & Dummies:** Identifies non-sensitive sample/mock strings (e.g. `your_api_key_here`).
- **Import Statements:** Avoids false alerts on library imports matching rule names.

### 4. 📊 Multi-Factor Risk & Priority Scoring
Instead of presenting a flat list of 30 "High Severity" alerts, findings are triaged through a composite heuristic model:

$$\text{Priority Score} = \text{Severity} \times \text{Exploitability} \times \text{Reachability} \times \text{Impact} \times \text{Correlation}$$

Findings are automatically categorized into actionable operational buckets:
- 🔥 **Fix Immediately ($\ge 80$):** High exploitability in production-reachable code.
- ⚡ **Fix This Sprint ($50-79$):** Valid risks requiring planned remediation.
- 📋 **Backlog ($20-49$):** Defense-in-depth improvements.
- ℹ️ **Informational ($< 20$):** Best practice notifications.

### 5. 🛡️ Safe Auto-Fix & Rollback Invariants
The `--fix` engine operates under strict safety constraints:
- **Only Deterministic Fixes:** Modifies only low-risk, unambiguous transformations (e.g., `http://` $\rightarrow$ `https://`, `rejectUnauthorized: false` $\rightarrow$ `true`).
- **Pre-flight Validation:** Checks target line matching, UTF-8 integrity, and balanced brackets/parentheses (`()`, `{}`, `[]`).
- **Atomic Operations:** Uses temporary swap files and creates `.agent-backup` snapshots.
- **Automatic Rollback:** If any post-fix syntax or validation check fails, the original file is restored instantly.
- **Architectural Changes are Protected:** Complex auth logic or storage rewrites are provided as suggested diffs in the report—never modified blindly.

---

## 📂 Architecture & File Breakdown

| File / Component | Responsibility |
| :--- | :--- |
| **`security-agent-ai.js`** | **Agent Orchestrator & CLI:** Manages execution flow, interactive prompts (`node:readline`), auto-fix lifecycle, and exit code thresholds for CI/CD. |
| **`lib/context-analyzer.js`** | **Context Engine:** Extracts code radius, applies 8 false-positive heuristics, and maps rule IDs to specific remediation templates. |
| **`lib/triage-engine.js`** | **Scoring & Correlation:** Calculates composite priority metrics, cross-correlates multi-file risks (e.g., token storage + logging), and generates the "Fix These First" list. |
| **`lib/agent-report.js`** | **Reporter:** Emits developer-friendly Markdown (`agent-report.md`) and machine-readable JSON for CI pipelines. |
| **`lib/scanner.js` & `lib/rules-*.js`** | **Detection Core:** Maintains granular mobile rule packs (OWASP MASVS aligned). |

---

## 🚀 How to Present & Demo to Leadership

### 1. The Quick 30-Second Elevator Pitch
> *"We built an in-house, zero-dependency security agent tailored for our React Native architecture. It runs in under 2 seconds across 500+ files completely offline, inspects 12 critical OWASP-aligned mobile security domains, filters out false alarms using surrounding code context, and gives engineers a prioritized 'Fix These First' list with exact code diffs."*

### 2. Live Demo Commands
```bash
# 1. Full codebase scan with executive summary & priority rankings
npm run security:agent

# 2. Fast CI-mode scan (Critical & High findings only)
npm run security:agent:quick

# 3. Interactive developer review mode
npm run security:agent:interactive

# 4. Instant single-file verification
node security-agent/security-agent-ai.js ./src/api/apiClient.ts
```

### 3. Business & Engineering Impact
- **Security Posture:** Prevents credentials, unencrypted AsyncStorage leaks, and deep-link vulnerabilities from reaching production builds.
- **Zero Cost:** No monthly SaaS bill or third-party token fees.
- **Developer Experience:** Clear before/after diffs reduce developer research time.
- **CI/CD Integration:** Integrates into pull request workflows via `--format=json` and `--fail-on=high`.
