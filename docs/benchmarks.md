# Benchmarking Guide 📊

This document explains how to benchmark both **your React Native codebase quality** and the **AI agents' performance/accuracy**.

---

## 🚀 Quick Run: Benchmark Suite

You can run the automated benchmark test harness across all 4 agents with a single command:

```bash
node benchmarks/run-benchmarks.js
```

### What It Evaluates:

```
┌──────────────────────────────────────────────────────────────────────┬────────┬──────────┬─────────┐
│ Benchmark                                                            │ Status │ Accuracy │ Latency │
├──────────────────────────────────────────────────────────────────────┼────────┼──────────┼─────────┤
│ UI Agent: Compliant Screen Token Verification                        │  PASS  │   100%   │  < 1ms  │
│ UI Agent: Non-Compliant Violation Catch Rate                         │  PASS  │   100%   │  < 1ms  │
│ Integration Agent: Direct API in JSX Detection                       │  PASS  │   100%   │  < 1ms  │
│ Security Agent: Vulnerability Detection & False-Positive Rejection   │  PASS  │   100%   │  < 5ms  │
└──────────────────────────────────────────────────────────────────────┴────────┴──────────┴─────────┘
```

---

## 1. Benchmarking Your React Native Codebase

Use each agent's static scanner and validator to benchmark project health and compliance:

### 🛡️ Security Health & OWASP MASVS Score
Generate comprehensive security metrics and historical trend tracking:

```bash
# Generate full benchmark report (HTML + JSON)
node agents/security-agent/security-agent.js ./src --format=html --history-dir=./security-agent-report

# Baseline diffing: ensure PRs introduce ZERO new security regressions
node agents/security-agent/security-agent.js ./src --baseline=baseline.json --fail-on=high
```

**Key Metrics Output:**
- **Security Score (0–100)**: Composite health score calculated by finding count & severity.
- **OWASP MASVS Compliance**: Percentage adherence to MASVS Storage, Network, and Auth categories.
- **Historical Trend Chart**: Visual track of score progression across commits in `scan-history.jsonl`.

---

### 🎨 UI & Design Token Compliance
Benchmark tokenization and Gluestack layout consistency:

```bash
node agents/ui-agent/ui-agent.js validate ./src/screens
```

**Key Metrics Output:**
- **Zero-Magic-Value Adherence**: Flags hardcoded hex colors (`#ffffff`) or raw numbers (`margin: 14`).
- **TestID Coverage**: Percentage of interactive components tagged with `testID`.
- **Component Modularity**: Flags oversized monolithic screen components.

---

### 🔌 API Contract & Type Purity
Benchmark OpenAPI schema conformance and TypeScript cleanliness:

```bash
node agents/api-agent/api-agent.js validate ./src/api
```

**Key Metrics Output:**
- **Schema Conformance**: 100% match against Swagger operation parameters and response types.
- **Zero Inline Types**: All types isolated in `src/types/*.types.ts` without inline `any` definitions.
- **Barrel Export Integrity**: Verifies all types and hooks are re-exported from `index.ts`.

---

### 🔄 Integration & Separation of Concerns
Benchmark clean architectural boundaries:

```bash
node agents/integration-agent/integration-agent.js validate ./src/screens
```

**Key Metrics Output:**
- **Zero Direct Networking in JSX**: Verifies no `.tsx` file directly imports `axios`, `fetch`, or declares raw `useQuery`.
- **State Handling Coverage**: Guarantees `isLoading`, `isError`, and `isEmpty` fallback states are bound.

---

## 2. Benchmarking AI Agent Performance

When evaluating AI coding models (Antigravity, Cursor, Claude Code, GitHub Copilot) executing these agent instructions:

| Metric | Target | How It Is Measured |
|---|:---:|---|
| **Pass@1 TypeScript Convergence** | **> 95%** | Measured by running `npx tsc --noEmit` immediately after agent generation. |
| **False-Positive Noise Rate** | **< 5%** | Evaluated by running `security-agent-ai.js` heuristic filters against codebases. |
| **Token Invariant Precision** | **100%** | Zero hardcoded hex colors or strings present in generated screens. |
| **Execution Latency** | **< 10ms** | Static analyzers and validator scripts execute in sub-10ms latency. |

---

## 📁 Benchmark Test Fixtures

Test fixtures are located in [`benchmarks/fixtures/`](../benchmarks/fixtures/):
- `benchmarks/fixtures/ui/`: Contains both fully compliant and intentionally non-compliant React Native screens.
- `benchmarks/fixtures/security/`: Contains vulnerable code patterns and false-positive test cases (comments, mocks, non-sensitive keys).
