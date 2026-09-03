---
name: figma-to-rn
description: Translates Figma design nodes, layout hierarchy, and styles to Gluestack React Native code.
---

# Figma to React Native Translation Skill

This skill outlines how to translate Figma design elements into clean React Native JSX using Gluestack UI components and design tokens.

---

## 1. Auto-Layout Translation Matrix

| Figma Auto-Layout | Gluestack Component | Key Props |
|---|---|---|
| Direction: Vertical | `<VStack>` | `space="md"`, `alignItems="..."` |
| Direction: Horizontal | `<HStack>` | `space="sm"`, `alignItems="center"`, `justifyContent="space-between"` |
| Frame / Fixed Container | `<Box>` | `p="$4"`, `bg={COLORS.CARD_BG}`, `borderRadius={Shape.card}` |
| Absolute Overlay | `<Box>` | `position="absolute"`, `top={0}`, `right={0}` |
| Touch Target | `<Pressable>` | `onPress={...}`, `testID="..."` |

---

## 2. Style & Token Mapping

1. **Colors**:
   - Inspect Figma fills (`#1E1E1E`, `#FF4500`).
   - Match with `COLORS` in `src/theme/color.ts`.
   - If the exact hex does not exist in `COLORS`, declare a semantic constant in `src/theme/color.ts`. Never use raw hex inline.

2. **Typography**:
   - Font Size: Map `12px` → `FontSize.xs`, `14px` → `FontSize.sm`, `16px` → `FontSize.md`, `18px` → `FontSize.lg`, `24px` → `FontSize['2xl']`.
   - Font Weight / Family: Map Inter/Barlow/Sora to `FONT_FAMILY.SORA.*` or `FONT_FAMILY.BARLOW.*`.

3. **Spacings & Padding**:
   - Map `4px` → `Spacing.xs`, `8px` → `Spacing.sm`, `12px` → `Spacing.md`, `16px` → `Spacing.lg`, `24px` → `Spacing['2xl']`.

---

## 3. Translation Process Steps

1. **Step 1 - Hierarchy Inspection**:
   - Identify header, scrollable body, fixed footer/action buttons, and modal sheets.
2. **Step 2 - Component Decomposition**:
   - If the design has repeated items (cards, list rows, badges), decompose into a dedicated subcomponent in `Components/`.
3. **Step 3 - View Model Definition**:
   - Define a pure TypeScript interface representing all visible fields (e.g. `title`, `subtitle`, `badgeText`, `avatarUrl`, `isActionActive`).
4. **Step 4 - Extract Strings**:
   - Move static text to `src/constant/strings/{featureName}.ts`.
5. **Step 5 - Assemble & Test**:
   - Compose with `<ScreenContainer>`, apply `testID`s, and run `npx tsc --noEmit`.
