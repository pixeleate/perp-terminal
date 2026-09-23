import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { analytics } from '@/lib/analytics/analytics';
import { env } from '@/lib/env';
import { addBreadcrumb, captureException } from '@/lib/observability/sentry';

import { privySdk, privyUnavailableReason } from './sdk';
import type { AuthContextValue, AuthUser, EmbeddedWalletSummary, OtpStatus } from './types';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}

/* -------------------------------------------------------------------------- */
/* Real Privy implementation                                                  */
/* -------------------------------------------------------------------------- */

const STUB_CODE = '123456';

function PrivyAuthBridge({ children }: { children: ReactNode }) {
  // Safe: this component only ever mounts when `privySdk` resolved.
  const sdk = privySdk!;
  const { user, isReady, logout } = sdk.usePrivy();
  const { sendCode, loginWithCode, state } = sdk.useLoginWithEmail();
  const solana = sdk.useEmbeddedSolanaWallet();
  const ethereum = sdk.useEmbeddedEthereumWallet();
  const [error, setError] = useState<string>();

  const wallets = useMemo<EmbeddedWalletSummary[]>(
    () => [
      {
        chain: 'solana',
        address: solana.wallets?.[0]?.address,
        status: solana.status,
      },
      {
        chain: 'ethereum',
        // `useEmbeddedEthereumWallet` exposes a wallet list rather than the
        // state machine the Solana hook returns, so derive a status from it.
        address: ethereum.wallets?.[0]?.address,
        status: ethereum.wallets?.length ? 'connected' : 'not-created',
      },
    ],
    [solana.wallets, solana.status, ethereum.wallets],
  );

  const mappedUser = useMemo<AuthUser | null>(() => {
    if (!user) return null;
    const emailAccount = user.linked_accounts?.find((account) => account.type === 'email');
    return {
      id: user.id,
      email: emailAccount && 'address' in emailAccount ? String(emailAccount.address) : undefined,
      createdAt: user.created_at ? Number(user.created_at) * 1000 : undefined,
      linkedAccounts: (user.linked_accounts ?? []).map((account) => account.type),
    };
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'privy',
      ready: isReady,
      user: mappedUser,
      otpStatus: state.status as OtpStatus,
      error: error ?? ('error' in state && state.error ? state.error.message : undefined),
      wallets,
      sendCode: async (email) => {
        setError(undefined);
        analytics.capture('auth_send_code', { mode: 'privy' });
        try {
          await sendCode({ email });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Failed to send code');
          captureException(cause, { step: 'privy.sendCode' });
        }
      },
      loginWithCode: async (code) => {
        setError(undefined);
        try {
          await loginWithCode({ code });
          analytics.capture('auth_login_success', { mode: 'privy' });
          addBreadcrumb('auth', 'privy login success');
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Invalid code');
          captureException(cause, { step: 'privy.loginWithCode' });
        }
      },
      logout: async () => {
        await logout();
        analytics.capture('auth_logout', { mode: 'privy' });
        analytics.reset();
      },
      createSolanaWallet: async () => {
        setError(undefined);
        try {
          await solana.create?.();
          analytics.capture('wallet_create', { chain: 'solana', mode: 'privy' });
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'Wallet creation failed');
          captureException(cause, { step: 'privy.createSolanaWallet' });
        }
      },
    }),
    [isReady, mappedUser, state, error, wallets, sendCode, loginWithCode, logout, solana],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* -------------------------------------------------------------------------- */
/* Stub implementation                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Mirrors the Privy hook surface so every screen is written against one
 * interface. It is labelled "stub" throughout the UI — it issues no tokens and
 * creates no wallet; the accept-any-`123456` OTP is a demo affordance, not a
 * security model.
 */
function StubAuthBridge({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [otpStatus, setOtpStatus] = useState<OtpStatus>('initial');
  const [pendingEmail, setPendingEmail] = useState<string>();
  const [error, setError] = useState<string>();

  const sendCode = useCallback(async (email: string) => {
    setError(undefined);
    setOtpStatus('sending-code');
    analytics.capture('auth_send_code', { mode: 'stub' });
    await new Promise((resolve) => setTimeout(resolve, 450));
    setPendingEmail(email);
    setOtpStatus('awaiting-code-input');
  }, []);

  const loginWithCode = useCallback(
    async (code: string) => {
      setError(undefined);
      setOtpStatus('submitting-code');
      await new Promise((resolve) => setTimeout(resolve, 450));
      if (code.trim() !== STUB_CODE) {
        setOtpStatus('error');
        setError(`Stub mode expects ${STUB_CODE}.`);
        return;
      }
      setUser({
        id: `stub:${pendingEmail ?? 'demo@perpterminal.local'}`,
        email: pendingEmail,
        createdAt: Date.now(),
        linkedAccounts: ['email'],
      });
      setOtpStatus('done');
      analytics.capture('auth_login_success', { mode: 'stub' });
    },
    [pendingEmail],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: 'stub',
      stubReason: privyUnavailableReason,
      ready: true,
      user,
      otpStatus,
      error,
      wallets: [],
      sendCode,
      loginWithCode,
      logout: async () => {
        setUser(null);
        setOtpStatus('initial');
        setPendingEmail(undefined);
        analytics.capture('auth_logout', { mode: 'stub' });
        analytics.reset();
      },
      createSolanaWallet: async () => {
        setError('Embedded wallets require a real Privy app ID and a development build.');
      },
    }),
    [user, otpStatus, error, sendCode, loginWithCode],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* -------------------------------------------------------------------------- */

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!privySdk) {
    return <StubAuthBridge>{children}</StubAuthBridge>;
  }
  const { PrivyProvider } = privySdk;
  return (
    <PrivyProvider appId={env.privyAppId!} clientId={env.privyClientId}>
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </PrivyProvider>
  );
}
