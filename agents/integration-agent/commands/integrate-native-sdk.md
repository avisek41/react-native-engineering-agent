# Integrate Native SDK

Scaffold a clean, typed wrapper around a third-party native SDK in `src/services/`.

## Steps
1. Determine SDK package name (e.g. Firebase, OneSignal, Sentry, Keychain).
2. Create `src/services/{sdkName}Service.ts`.
3. Provide singleton class or export object with typed methods.
4. Implement platform check (`Platform.OS`) and permission requests.
5. Provide safe fallback behavior if module is unlinked or run in simulator.
