# Build Screen Coordinator Hook

Generate a standardized screen coordinator hook (`use{Screen}Screen.ts`) connecting UI view models to TanStack Query hooks.

## Steps
1. Locate target screen in `src/screens/{Stack}/{ScreenName}/`.
2. Inspect `types.ts` for the screen's ViewModel interface.
3. Import the required query/mutation hooks from `'hooks'`.
4. Generate `src/utils/{screenName}Mapper.ts` to map DTOs to the ViewModel.
5. Create `use{ScreenName}Screen.ts` exposing state, refresh, and pagination handlers.
6. Connect the hook to `src/screens/{Stack}/{ScreenName}/{ScreenName}.tsx`.
7. Verify compiler: `npx tsc --noEmit`.
