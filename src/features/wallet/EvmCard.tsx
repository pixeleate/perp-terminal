import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { Button, Card, KeyValue, SectionTitle } from '@/components/ui';
import { env } from '@/lib/env';
import { checksum, fromBaseUnits, readChainHead, toBaseUnits, type ChainHead } from '@/lib/evm/viem';
import { fonts } from '@/lib/theme';

const SAMPLE_ADDRESS = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';

const MONO = { fontFamily: fonts.mono, fontSize: 11 };

export function EvmCard() {
  const [head, setHead] = useState<ChainHead | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const read = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      const next = await readChainHead();
      setHead(next);
      if (!next) setError('Set EXPO_PUBLIC_EVM_RPC_URL to enable the live read.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'RPC read failed');
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <View>
      <SectionTitle hint="viem">EVM helpers</SectionTitle>
      <Card>
        <KeyValue
          label="Checksum address"
          value={checksum(SAMPLE_ADDRESS) ?? 'invalid'}
          valueStyle={MONO}
        />
        <KeyValue divider label="parseUnits('1234.56', 6)" value={toBaseUnits('1234.56').toString()} valueStyle={MONO} />
        <KeyValue
          divider
          label="formatUnits round-trip"
          value={fromBaseUnits(toBaseUnits('1234.56'))}
          valueStyle={MONO}
        />
        <KeyValue
          divider
          label="Arbitrum head"
          value={head ? `#${head.blockNumber} · ${Number(head.gasPriceGwei).toFixed(4)} gwei` : '—'}
          valueStyle={MONO}
        />

        {error ? <Text className="mt-2 font-regular text-xs text-down">{error}</Text> : null}

        <Button
          className="mt-3"
          label={busy ? 'Reading…' : env.evmRpcUrl ? 'Read chain head' : 'No RPC configured'}
          onPress={() => void read()}
          disabled={busy}
          accessibilityLabel="Read the Arbitrum chain head over RPC"
          accessibilityState={{ busy }}
        />

        <Text className="mt-3 font-regular text-caption text-fg-faint">
          Hyperliquid settles on Arbitrum and signs orders as EIP-712 typed data, so viem does the
          unit maths and digest hashing on the trade ticket. Everything except the chain-head read
          is offline.
        </Text>
      </Card>
    </View>
  );
}
