---
name: component-generator
description: Generates standardized, accessible, and typed React Native UI components conforming to project standards.
---

# Component Generator Skill

This skill provides guidelines for scaffolding new reusable UI primitives under `src/components/ui/` or screen-local components under `src/screens/{Stack}/{ScreenName}/Components/`.

---

## 1. When to Make a Shared vs. Screen-Local Component

- **Screen-Local (`src/screens/{Stack}/{ScreenName}/Components/`)**:
  - The component is only used by this specific screen.
  - Keeps feature code cohesive and prevents polluting the global component library.
- **Shared Primitive (`src/components/ui/{ComponentName}/`)**:
  - Used by **2 or more screens** across different modules.
  - Exported through `src/components/ui/index.ts` and `src/components/index.ts`.

---

## 2. Standard Component File Structure

```
src/components/ui/{ComponentName}/
├── {ComponentName}.tsx     # Component implementation
├── types.ts                # Props interface and variant types
├── styles.ts               # StyleSheet styles (if complex)
└── index.ts                # Named export
```

---

## 3. Implementation Invariants

1. **Props Contract**:
   - Always export a typed `{ComponentName}Props` interface from `types.ts`.
   - Include optional `testID?: string` with a fallback default.
   - Include optional `style?: StyleProp<ViewStyle>` or Gluestack style overrides.
2. **Gluestack First**:
   - Use Gluestack containers (`Box`, `HStack`, `VStack`, `Pressable`, `Text`).
3. **Accessibility & Testability**:
   - Set `accessible={true}` and meaningful `accessibilityLabel` when required.
   - Attach `testID`.
4. **Memoization**:
   - Only wrap in `React.memo` if the component receives complex props or renders in large lists.
