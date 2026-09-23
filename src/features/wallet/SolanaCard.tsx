import { useCallback, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Banner, Button, Card, KeyValue, Pill, SectionTitle } from '@/components/ui';
import { analytics } from '@/lib/analytics/analytics';
import { env } from '@/lib/env';
import { shortenAddress } from '@/lib/format';
import { captureException } from '@/lib/observability/sentry';
import {
  buildAuthMessage,
  fetchBalance,
  forgetKeypair,
  isDevnet,
  loadOrCreateKeypair,
  requestAirdrop,
  signMessage,
  type SignedMessage,
  type SolanaKeypair,
} from '@/lib/solana/wallet';
import { colors, fonts } from '@/lib/theme';

export function SolanaCard() {
  const [keypair, setKeypair] = useState<SolanaKeypair | null>(null);
  const [balance, setBalance] = useState<number>();
  const [signed, setSigned] = useState<SignedMessage>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const refreshBalance = useCallback(async (publicKey: string) => {
    try {
      setBalance(await fetchBalance(publicKey));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'RPC unreachable');
    }
  }, []);

  const connect = useCallback(async () => {
    setBusy('connect');
    setError(undefined);
    try {
      const pair = await loadOrCreateKeypair();
      setKeypair(pair);
      analytics.capture('solana_connected', { network: isDevnet() ? 'devnet' : 'custom' });
      await refreshBalance(pair.publicKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load keypair');
      captureException(cause, { step: 'solana.connect' });
    } finally {
      setBusy(undefined);
    }
  }, [refreshBalance]);

  const sign = useCallback(() => {
    if (!keypair) return;
    const nonce = Math.random().toString(36).slice(2, 10);
    const result = signMessage(keypair, buildAuthMessage(keypair.publicKey, nonce));
    setSigned(result);
    analytics.capture('solana_message_signed', { verified: result.verified });
  }, [keypair]);

  const airdrop = useCallback(async () => {
    if (!keypair) return;
    setBusy('airdrop');
    setError(undefined);
    try {
      await requestAirdrop(keypair.publicKey);
      await refreshBalance(keypair.publicKey);
      analytics.capture('solana_airdrop');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `Airdrop failed: ${cause.message}`
          : 'Airdrop failed (devnet faucet is rate limited)',
      );
    } finally {
      setBusy(undefined);
    }
  }, [keypair, refreshBalance]);

  const disconnect = useCallback(async () => {
    await forgetKeypair();
    setKeypair(null);
    setBalance(undefined);
    setSigned(undefined);
    analytics.capture('solana_disconnected');
  }, []);

  return (
    <View>
      <SectionTitle hint={isDevnet() ? 'devnet' : 'custom RPC'}>Solana</SectionTitle>

      <View className="mb-2">
        <Banner
          tone="warn"
          title="LOCAL DEVNET KEYPAIR"
          body="Not a wallet connection. The key is generated on device and held in the OS keychain; signing and verification are real ed25519 and the balance is a real RPC read. Production would use Mobile Wallet Adapter or a Privy embedded wallet."
        />
      </View>

      <Card>
        {!keypair ? (
          <Button
            variant="accent"
            label={busy === 'connect' ? 'Connecting…' : 'Connect devnet keypair'}
            onPress={() => void connect()}
            disabled={busy === 'connect'}
            accessibilityLabel="Connect local devnet keypair"
            accessibilityState={{ busy: busy === 'connect' }}
            testID="solana-connect"
          />
        ) : (
          <View className="gap-2">
            <View className="flex-row gap-2">
              <Pill label="Connected" tone="up" />
              <Pill label={isDevnet() ? 'Devnet' : 'Custom RPC'} tone="accent" />
            </View>

            <View>
              <KeyValue
                label="Address"
                value={shortenAddress(keypair.publicKey, 6, 6)}
                valueStyle={{ fontFamily: fonts.mono, fontSize: 12 }}
              />
              <KeyValue
                divider
                label="Balance"
                value={balance === undefined ? '—' : `${balance.toFixed(4)} SOL`}
              />
              <KeyValue
                divider
                label="RPC"
                value={env.solanaRpcUrl.replace('https://', '')}
                valueStyle={{ fontSize: 11, color: colors.textSecondary }}
              />
            </View>

            {signed ? (
              <View className="gap-1 rounded-md border border-line bg-raised p-3">
                <View className="flex-row gap-2">
                  <Pill
                    label={signed.verified ? 'Signature verified' : 'Verification failed'}
                    tone={signed.verified ? 'up' : 'down'}
                  />
                </View>
                <Text className="font-mono text-2xs text-fg-faint" numberOfLines={2}>
                  {signed.signature}
                </Text>
              </View>
            ) : null}

            {error ? <Text className="font-regular text-xs text-down">{error}</Text> : null}

            <View className="mt-1 flex-row gap-2">
              <Button
                variant="accent"
                label="Sign message"
                className="flex-1"
                onPress={sign}
                accessibilityLabel="Sign a sign-in message"
                testID="solana-sign"
              />
              <Button
                className="flex-1"
                onPress={() => void airdrop()}
                disabled={!isDevnet() || busy === 'airdrop'}
                accessibilityLabel="Request a devnet airdrop"
              >
                {busy === 'airdrop' ? (
                  <ActivityIndicator color={colors.textMuted} />
                ) : (
                  <Text className="font-semibold text-sm text-fg-secondary">Airdrop</Text>
                )}
              </Button>
            </View>

            <Button
              label="Forget keypair"
              onPress={() => void disconnect()}
              accessibilityLabel="Forget this keypair"
            />
          </View>
        )}
      </Card>
    </View>
  );
}
