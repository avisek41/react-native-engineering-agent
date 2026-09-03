# Review UI Command

Execute a comprehensive audit of UI components or screens against project design standards, tokens, and boundary rules.

---

## 📋 Arguments / Prompt Format

```
/review-ui
Path: <file or directory path to review, e.g. src/screens/Main/HomeScreen>
```

---

## ⚙️ Audit Checklist

1. **Design Tokens Compliance**:
   - Zero raw hex codes (`#FFFFFF` -> `COLORS.WHITE`).
   - Zero magic numeric paddings/margins (`padding: 16` -> `Spacing.lg`).
   - Zero magic font sizes (`fontSize: 14` -> `FontSize.sm`).
2. **Strings Localization**:
   - Zero hardcoded English strings in JSX (`<Text>Save</Text>` -> `<Text>{STRINGS.COMMON.SAVE}</Text>`).
3. **Gluestack UI Priority**:
   - Verify Gluestack primitives (`Box`, `HStack`, `VStack`, `Pressable`) are preferred over React Native `View`/`TouchableOpacity`.
4. **List Performance**:
   - Verify large/dynamic lists use `LegendList` instead of `FlatList`.
5. **Accessibility & Testability**:
   - Verify `testID` exists on all interactive buttons, inputs, screens, and lists.
6. **Architecture Boundary**:
   - Confirm no direct `useQuery` / `src/api` imports in UI screens or components.
