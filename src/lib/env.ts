/**
 * Every value here is public-by-design (EXPO_PUBLIC_* is inlined into the JS
 * bundle at build time) and every value is optional. The app must boot, render
 * and be demo-able with a completely empty .env — missing keys downgrade a
 * feature to a clearly-labelled stub instead of crashing.
 */

const read = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
};

export const env = {
  privyAppId: read(process.env.EXPO_PUBLIC_PRIVY_APP_ID),
  privyClientId: read(process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID),
  posthogKey: read(process.env.EXPO_PUBLIC_POSTHOG_KEY),
  posthogHost: read(process.env.EXPO_PUBLIC_POSTHOG_HOST) ?? 'https://us.i.posthog.com',
  sentryDsn: read(process.env.EXPO_PUBLIC_SENTRY_DSN),
  solanaRpcUrl: read(process.env.EXPO_PUBLIC_SOLANA_RPC_URL) ?? 'https://api.devnet.solana.com',
  evmRpcUrl: read(process.env.EXPO_PUBLIC_EVM_RPC_URL),
  hyperliquidApiUrl:
    read(process.env.EXPO_PUBLIC_HYPERLIQUID_API_URL) ?? 'https://api.hyperliquid.xyz',
  hyperliquidWsUrl:
    read(process.env.EXPO_PUBLIC_HYPERLIQUID_WS_URL) ?? 'wss://api.hyperliquid.xyz/ws',
} as const;

export type EnvKey = keyof typeof env;

/** Drives the "env status" panel on the Settings screen. */
export type FeatureStatus = {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
};

export const featureStatuses = (): FeatureStatus[] => [
  {
    id: 'privy',
    label: 'Privy auth',
    configured: Boolean(env.privyAppId && env.privyClientId),
    detail: env.privyAppId
      ? 'App ID present — real SDK path'
      : 'No EXPO_PUBLIC_PRIVY_APP_ID — mock session',
  },
  {
    id: 'posthog',
    label: 'PostHog analytics',
    configured: Boolean(env.posthogKey),
    detail: env.posthogKey ? 'Key present — events sent' : 'No key — events logged locally only',
  },
  {
    id: 'sentry',
    label: 'Sentry',
    configured: Boolean(env.sentryDsn),
    detail: env.sentryDsn ? 'DSN present — errors reported' : 'No DSN — SDK not initialised',
  },
  {
    id: 'solana',
    label: 'Solana RPC',
    configured: true,
    detail: env.solanaRpcUrl,
  },
  {
    id: 'hyperliquid',
    label: 'Hyperliquid API',
    configured: true,
    detail: env.hyperliquidApiUrl,
  },
  {
    id: 'evm',
    label: 'EVM RPC (viem)',
    configured: Boolean(env.evmRpcUrl),
    detail: env.evmRpcUrl ?? 'No RPC — viem used for offline helpers only',
  },
];
