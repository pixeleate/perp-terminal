# Environment setup

Every variable is optional. The app runs with an empty `.env`, and each missing
key turns one feature into a labelled stub. This guide covers the keys that
switch those stubs to the real services.

```bash
cp .env.example .env
```

All keys use the `EXPO_PUBLIC_` prefix, so they're inlined into the JS bundle
at build time. Only put public, client-side values in them, never server secrets. After
editing `.env`, restart Metro with a cleared cache:

```bash
bun start --clear
```

The **Environment** section on the Settings tab shows which features found their keys.

| Variable | Needed for | Cost | Works in Expo Go |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_PRIVY_APP_ID` | Real Privy login + embedded wallet | Free tier | No (dev build) |
| `EXPO_PUBLIC_PRIVY_CLIENT_ID` | Same | Free tier | No (dev build) |
| `EXPO_PUBLIC_POSTHOG_KEY` | Sending analytics events | Free tier | Yes |
| `EXPO_PUBLIC_POSTHOG_HOST` | PostHog region (US/EU) | — | Yes |
| `EXPO_PUBLIC_SENTRY_DSN` | Error reporting | Free tier | JS errors yes, native crashes need a dev build |
| `EXPO_PUBLIC_EVM_RPC_URL` | viem live chain read (Arbitrum) | Free public RPC | Yes |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | Solana devnet balance + airdrop | Free (default set) | Yes |
| `EXPO_PUBLIC_HYPERLIQUID_API_URL` | Markets, candles, order book | Free, no key (default set) | Yes |
| `EXPO_PUBLIC_HYPERLIQUID_WS_URL` | Live price stream | Free, no key (default set) | Yes |

---

## 1. Privy (auth + embedded Solana wallet)

The app uses email one-time-code login (`useLoginWithEmail`) and creates an
embedded Solana wallet after login (`useEmbeddedSolanaWallet`).

1. Sign up at <https://dashboard.privy.io> and create an app.
2. Copy the **App ID** from the app's settings into `EXPO_PUBLIC_PRIVY_APP_ID`.
3. Create a **client** for the mobile app. Privy calls these app clients, and
   they live under the app's client or platform settings.
   - Add `com.perpterminal.app` as an allowed app identifier. That's the iOS
     bundle ID and Android package from `app.json`.
   - Copy the **Client ID** into `EXPO_PUBLIC_PRIVY_CLIENT_ID`.
4. Under **Login methods**, enable **Email**.
5. Under **Embedded wallets**, enable **Solana**.
6. Build a development client, because Privy's native modules aren't included in Expo Go:

   ```bash
   bunx expo run:ios            # simulator
   bunx expo run:ios --device   # physical iPhone
   ```

Check it: on the Wallet tab, the Privy auth card should say **real SDK**
instead of **stub**. Log in with an email code, then tap **Create Solana wallet**.

> If you later want Apple / Google login, enable it in the dashboard *and*
> reinstall the matching Expo module (`bunx expo install expo-apple-authentication`).
> Apple sign-in also needs an explicit App ID with the Sign in with Apple
> capability. A wildcard provisioning profile won't work.

## 2. PostHog (analytics)

1. Sign up at <https://posthog.com> and create a project.
2. Go to **Project settings → Project API key** (starts with `phc_`) and copy it into
   `EXPO_PUBLIC_POSTHOG_KEY`. This key is public by design.
3. Set `EXPO_PUBLIC_POSTHOG_HOST` to match your region:
   - US cloud: `https://us.i.posthog.com` (default)
   - EU cloud: `https://eu.i.posthog.com`

Check it: turn on **Debug logging** under PostHog in Settings, open a few screens and a
market, then look at **Activity** in PostHog. You should see screen views,
`app_opened`, `market_opened`, `chart_interval_changed` and, after a held trade,
`order_submitted` and `order_filled`.

## 3. Sentry (error reporting)

1. Sign up at <https://sentry.io> and create a **React Native** project.
2. Copy the project's **DSN** from **Project settings → Client Keys (DSN)** into
   `EXPO_PUBLIC_SENTRY_DSN`. The DSN is public by design.

Check it: tap **Handled error** or **Test message** under Sentry in Settings.
The event shows up under **Issues** within a few seconds, tagged
`environment: development`. **Throw unhandled error** tests the crash path.

Not set up in this spike: source-map upload. Stack traces will point at
bundled code. To get readable traces, add the `@sentry/react-native` config
plugin and a `SENTRY_AUTH_TOKEN`, which is a real secret, so keep it out of `EXPO_PUBLIC_*` and use an
EAS secret instead.

## 4. EVM RPC (viem, Arbitrum One)

viem reads the latest block, gas price and chain ID from **Arbitrum One**
(the chain Hyperliquid bridges from). Any HTTPS Arbitrum endpoint works:

- Public, no signup: `https://arb1.arbitrum.io/rpc`
- Better rate limits: an Arbitrum mainnet URL from Alchemy, Infura, QuickNode
  or Ankr (free tiers are enough)

```bash
EXPO_PUBLIC_EVM_RPC_URL=https://arb1.arbitrum.io/rpc
```

Without it, viem still runs its offline helpers (EIP-712 order digest, unit
conversion). Only the live chain read is skipped.

## 5. Solana RPC (devnet)

The default `https://api.devnet.solana.com` works without an account. It does
rate-limit airdrops. If **Airdrop** keeps failing, either:

- use a free devnet RPC from Helius or QuickNode, or
- fund the address shown on the Wallet tab from <https://faucet.solana.com>.

Stay on **devnet**. The local keypair is kept in SecureStore on the device.
It's a demo wallet, not a place for real funds.

## 6. Hyperliquid (market data)

Public API, no key. Defaults point at mainnet market data, which is read-only.
Nothing in the app places orders. To use testnet data instead:

```bash
EXPO_PUBLIC_HYPERLIQUID_API_URL=https://api.hyperliquid-testnet.xyz
EXPO_PUBLIC_HYPERLIQUID_WS_URL=wss://api.hyperliquid-testnet.xyz/ws
```

---

## Fully working `.env`

```bash
EXPO_PUBLIC_PRIVY_APP_ID=<from Privy dashboard>
EXPO_PUBLIC_PRIVY_CLIENT_ID=<from Privy dashboard, client for com.perpterminal.app>
EXPO_PUBLIC_POSTHOG_KEY=phc_<...>
EXPO_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
EXPO_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
EXPO_PUBLIC_EVM_RPC_URL=https://arb1.arbitrum.io/rpc
EXPO_PUBLIC_HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
EXPO_PUBLIC_HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws
```

`.env` is gitignored. Only `.env.example` is committed.
