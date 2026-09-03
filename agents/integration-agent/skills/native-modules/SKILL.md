---
name: native-modules
description: Protocol for integrating third-party native SDKs and custom platform bridges in React Native.
---

# Native Modules & SDK Integration Protocol

## Steps

1. **Verify Environment Compatibility**:
   - Check if project uses Expo (Config Plugins / Prebuild) or Bare React Native.
   - Verify minimum iOS Deployment Target and Android `minSdkVersion` / `compileSdkVersion`.

2. **Installation & Configuration**:
   - Install dependencies using project package manager (`yarn`, `npm`, `pnpm`, `bun`).
   - If bare React Native, run `pod install` in `ios/`.
   - If Expo, configure `app.json` config plugins and run `npx expo prebuild` if testing native code.

3. **Wrap in Service Layer**:
   - Create an abstraction in `src/services/{sdkName}Service.ts`.
   - Never call third-party SDK methods directly across multiple UI components; expose a clean, typed wrapper interface.

4. **Permissions & Fallbacks**:
   - Implement platform permission requests before accessing device hardware (Camera, Location, Notifications).
   - Provide graceful fallback handling when permissions are denied or native module is unavailable.
