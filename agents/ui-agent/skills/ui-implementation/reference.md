# UI Implementation Reference & Design Tokens

## 1. Design Tokens Reference

| Need | Token Category | Import Source | Example |
| --- | --- | --- | --- |
| Color | `COLORS` | `import { COLORS } from '@theme'` | `color: COLORS.PRIMARY` |
| Font family | `FONT_FAMILY.SORA.*` / `BARLOW.*` | `import { FONT_FAMILY } from '@theme'` | `fontFamily: FONT_FAMILY.SORA.BOLD` |
| Spacing | `Spacing` (`xs=4` ... `'6xl'=64`) | `import { Spacing } from 'constant'` | `padding: Spacing.md` |
| Font size | `FontSize` (`xs=12` ... `'4xl'=32`) | `import { FontSize } from 'constant'` | `fontSize: FontSize.lg` |
| Radius | `Radius` / `Shape` | `import { Radius, Shape } from 'constant'` | `borderRadius: Shape.card` |
| Layout | `Layout.screenPaddingHorizontal` | `import { Layout } from 'constant'` | `paddingHorizontal: Layout.screenPaddingHorizontal` |
| Border | `BorderWidth` | `import { BorderWidth } from 'constant'` | `borderWidth: BorderWidth.thin` |
| Copy | `STRINGS` | `import { STRINGS } from 'constant'` | `{STRINGS.HOME.TITLE}` |
| Icons | `lucide-react-native` | `lucide-react-native` | `<ChevronRight size={20} color={COLORS.WHITE} />` |

---

## 2. Reusable Component Catalog

Import common primitives from `'components'`:

| Need | Preferred Component | Description |
| --- | --- | --- |
| Screen Container | `ScreenContainer` | Safe-area + keyboard aware screen root |
| Header | `AppHeader` | Standardized header with back/action buttons |
| Primary Button | `AppButton` | Styled button with loading state & variant support |
| Text Input | `InputField` | Standard text input with floating label & validation |
| Search Bar | `SearchInput` | Debounced search input with clear trigger |
| Card Box | `CardContainer` | Standard card container with borders & elevation |
| Filter Badge | `Chip` | Interactive badge with selection state |
| Tabs | `AnimatedTabButton` | Animated horizontal tab switcher |
| List Empty | `NoData` | Placeholder with icon, message & action button |
| Loading | `Loader` | Activity indicator with skeleton or spinner |
| Error State | `ScreenErrorState` | Full screen or modular error retry container |
| Separator | `ItemSeparator` | Standard list divider |
| Bottom Sheet | `AppActionSheet` | Reusable bottom modal sheet |

---

## 3. High Performance Lists (LegendList)

Dynamic product lists must use `LegendList` from `@legendapp/list`:

```tsx
<LegendList
  ItemSeparatorComponent={ItemSeparator}
  ListEmptyComponent={
    <NoData containerTestID="player-list-empty" message={STRINGS.PLAYERS.NO_DATA} />
  }
  contentContainerStyle={styles.listContent}
  data={players}
  estimatedItemSize={Spacing['5xl']}
  keyExtractor={item => item.id}
  renderItem={renderItem}
  showsVerticalScrollIndicator={false}
  testID="player-list"
/>
```

---

## 4. Import Ordering Standard

Always order imports:
1. `// external` (React Native, Gluestack, LegendList, Lucide)
2. `// internal` (components, constant, theme, navigation)

Within each group, sort from longest import path to shortest.
