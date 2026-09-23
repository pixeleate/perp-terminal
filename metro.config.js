// Learn more: https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

/**
 * Privy's Expo guide recommends turning package exports off wholesale because a
 * few of its transitive deps (isows, jose, zustand@4) ship exports maps Metro
 * trips over. Doing that breaks other packages that rely on subpath exports —
 * posthog-react-native imports `@posthog/core/surveys`, which only resolves
 * through an exports map. So exports stay on, and the handful of packages that
 * need the legacy main/browser fields are listed here instead.
 */
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ['require', 'react-native', 'browser', 'default'];

/**
 * @noble/hashes' own utils.js requires `@noble/hashes/crypto`, which its
 * `browser` field rewrites to `./crypto.js` — a subpath its exports map doesn't
 * list, so Metro warns and falls back to file resolution on every bundle.
 * Point the import at that file directly (the WebCrypto shim, not cryptoNode).
 */
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@noble/hashes/crypto' || moduleName === '@noble/hashes/crypto.js') {
    const entry = require.resolve('@noble/hashes/crypto', { paths: [context.originModulePath] });
    return { type: 'sourceFile', filePath: path.join(path.dirname(entry), 'crypto.js') };
  }
  return context.resolveRequest(context, moduleName, platform);
};

// NativeWind defaults to a 14px rem on native; 16 keeps Tailwind's spacing
// scale on the 4pt grid the design uses (p-4 = 16, gap-3 = 12, …).
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
