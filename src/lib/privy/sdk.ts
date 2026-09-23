import { env } from '@/lib/env';

type PrivySdk = typeof import('@privy-io/expo');

/**
 * Privy's Expo SDK depends on native modules (`@privy-io/expo-native-extensions`,
 * `react-native-passkeys`) that are not in Expo Go. Requiring it there throws at
 * import time and takes the whole bundle down.
 *
 * Resolving it once, defensively, at module scope gives us a constant for the
 * lifetime of the app. That constant is what decides which auth implementation
 * mounts — and because it never changes, each implementation can call its own
 * hooks unconditionally. No conditional hook calls anywhere.
 */
function resolve(): { sdk: PrivySdk | null; reason?: string } {
  if (!env.privyAppId) {
    return { sdk: null, reason: 'EXPO_PUBLIC_PRIVY_APP_ID is not set.' };
  }
  try {
    // Intentionally a runtime require: a static import would be hoisted and
    // would throw at module-evaluation time in Expo Go, before this try block.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sdk = require('@privy-io/expo') as PrivySdk;
    if (typeof sdk?.PrivyProvider !== 'function') {
      return { sdk: null, reason: 'Privy SDK loaded but PrivyProvider is missing.' };
    }
    return { sdk };
  } catch (cause) {
    return {
      sdk: null,
      reason: `Privy native modules unavailable (${
        cause instanceof Error ? cause.message : 'unknown error'
      }). Run a development build: npx expo run:ios.`,
    };
  }
}

const resolved = resolve();

export const privySdk = resolved.sdk;
export const privyUnavailableReason = resolved.reason;
export const isPrivyAvailable = resolved.sdk !== null;
