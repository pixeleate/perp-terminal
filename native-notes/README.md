# Swift / Kotlin: when I'd drop to native

**Not in this repo, on purpose.** There is no `ios/` or `android/` directory here — Expo
generates them from `app.json` via Continuous Native Generation. Hand-writing a native
module to demonstrate that I can would have added a build step, broken Expo Go, and proved
less than the rest of the app does.

For a v1 of something like Arcade, Expo covers it: Reanimated, Skia, Gesture Handler,
SecureStore, Haptics and the wallet SDKs are all available without touching Xcode or
Android Studio, and EAS builds and ships without a local native toolchain.

## Where Expo stops and I'd write native code

**1. Order-entry latency under contention.** If profiling showed the JS thread losing
frames on a hot book — many symbols, deep L2, sub-100ms updates — I'd move the websocket
parse and the diff into native: `URLSessionWebSocketTask` on iOS, OkHttp on Android, decode
off the main thread, and push only the deltas the UI needs across the bridge. That is a
Swift/Kotlin problem, not a React one.

**2. Secure enclave / StrongBox key custody.** `expo-secure-store` is the Keychain and
Keystore, which is the right default. A wallet that holds real balances wants keys generated
in and never leaving the Secure Enclave (iOS) or StrongBox (Android), with biometric-gated
signing. That is a `SecKeyCreateRandomKey` / `KeyGenParameterSpec` module — maybe 200 lines
of Swift and Kotlin behind a thin TypeScript interface.

**3. Widgets, Live Activities and complications.** A price widget or a Dynamic Island Live
Activity for a working order is SwiftUI + WidgetKit on iOS and Glance on Android. There is
no React Native path; it's a native target that shares data through an app group.

**4. Push-triggered background work.** Silent pushes that refresh positions before the user
opens the app mean `BGTaskScheduler` and `WorkManager`.

## How I'd structure it

An Expo config plugin plus a local Expo Module (`expo-module-scripts`), so the native code
lives in-repo, stays typed at the TypeScript boundary, and CNG keeps regenerating the
projects. Never a checked-in, hand-edited `ios/` directory.
