# Build Component Command

Execute the UI Agent to build a reusable UI primitive under `src/components/ui/` or a screen-local component.

---

## 📋 Arguments / Prompt Format

```
/build-component
Name: <ComponentName, e.g. StatusBadge>
Scope: <shared | screen-local>
TargetDir: <optional custom directory, e.g. src/components/ui/StatusBadge>
Props: <Key props and callback specifications>
```

---

## ⚙️ Execution Flow

1. For shared components:
   - Create `src/components/ui/{ComponentName}/{ComponentName}.tsx`
   - Create `src/components/ui/{ComponentName}/types.ts`
   - Create `src/components/ui/{ComponentName}/index.ts`
   - Export in `src/components/ui/index.ts` and `src/components/index.ts`
2. Implement using Gluestack UI (`Box`, `HStack`, `VStack`, `Pressable`, `Text`).
3. Ensure all styles use `COLORS`, `Spacing`, `FontSize`, `Shape`.
4. Include explicit `testID` attribute with sensible fallback.
5. Validate via `npx tsc --noEmit`.
