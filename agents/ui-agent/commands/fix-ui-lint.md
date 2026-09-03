# Fix UI Lint Command

Automatically detect and correct UI violations, broken tokens, missing imports, and TypeScript errors in-loop.

---

## 📋 Arguments / Prompt Format

```
/fix-ui-lint
Target: <file or directory, e.g. src/screens/Main/PlayerProfile>
```

---

## ⚙️ Automated Remediation Actions

1. Run `node ui-agent/ui-agent.js validate <Target>` to capture all static violations.
2. Replace hardcoded hex colors with the closest matching token in `src/theme/color.ts` or add a new named constant.
3. Replace hardcoded numbers with `Spacing.*`, `FontSize.*`, or `Radius.*` from `constant`.
4. Migrate raw text literals into the corresponding `src/constant/strings/` module.
5. Re-run `npx tsc --noEmit` until zero TypeScript errors remain.
