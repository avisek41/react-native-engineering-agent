# Build Screen Command

Execute the UI Agent to implement or scaffold a presentational React Native screen from a Figma design or UI specification.

---

## 📋 Arguments / Prompt Format

```
/build-screen
Screen: <ScreenName, e.g. PlayerProfile>
Stack: <Main | Auth>
Design: <Figma URL or screenshot reference>
Requirements: <Any specific layout or behavior details>
```

---

## ⚙️ Execution Flow

1. Check if screen already exists in `src/screens/{Stack}/{ScreenName}/`.
   - If yes: Preserve existing data hooks & navigation parameters, restyle layout only.
   - If no: Scaffold `src/screens/{Stack}/{ScreenName}/{ScreenName}.tsx`, `types.ts`, `Components/`, `index.ts`.
2. Extract all strings into `src/constant/strings/{screenName}.ts` and register in `src/constant/strings/index.ts`.
3. If new screen: Register route in `src/navigation/NavigationUtilis.ts` and stack params.
4. Compose layout using `<ScreenContainer>`, `<AppHeader>`, Gluestack components, and design tokens (`COLORS`, `Spacing`, `FontSize`, `Shape`).
5. Run TypeScript type check (`npx tsc --noEmit`) and self-correct any issues.
6. Emit final **UI Handoff** contract.
