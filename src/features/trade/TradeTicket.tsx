import { useMemo, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Banner, KeyValue, SectionTitle } from '@/components/ui';
import { hashOrderIntent, toBaseUnits } from '@/lib/evm/viem';
import { formatPrice, formatUsd } from '@/lib/format';
import type { Market } from '@/lib/hyperliquid/types';
import { useTick } from '@/lib/store/tickStore';
import { colors, fonts } from '@/lib/theme';

import { HoldToConfirm } from './HoldToConfirm';
import { OrderList } from './OrderList';
import {
  PAPER_BALANCE_USDC,
  ordersStore,
  useAvailableUsdc,
  useOrdersForCoin,
  type OrderSide,
} from './ordersStore';
import { SideToggle } from './SideToggle';

const PRESETS = [
  { label: '25%', fraction: 0.25 },
  { label: '50%', fraction: 0.5 },
  { label: '75%', fraction: 0.75 },
  { label: 'Max', fraction: 1 },
] as const;

/** Tap the slippage value to step through these. */
const SLIPPAGE_BPS = [10, 50, 100] as const;

const TAKER_FEE = 0.00035;

const formatUsdc = (value: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: 2 });

export function TradeTicket({ market }: { market: Market }) {
  const [side, setSide] = useState<OrderSide>('buy');
  const [notional, setNotional] = useState<string>('');
  const [preset, setPreset] = useState<number | null>(null);
  const [slippageIndex, setSlippageIndex] = useState(1);
  const tick = useTick(market.coin);
  const orders = useOrdersForCoin(market.coin);
  const available = useAvailableUsdc();

  const price = tick?.px ?? market.midPx;
  const tint = side === 'buy' ? colors.up : colors.down;
  const slippageBps = SLIPPAGE_BPS[slippageIndex]!;

  const parsed = Number.parseFloat(notional);
  const entered = Number.isFinite(parsed) && parsed > 0 && price > 0;
  const insufficient = entered && parsed > available + 1e-9;
  const valid = entered && !insufficient;
  const estimatedSize = entered ? parsed / price : 0;
  const fee = entered ? parsed * TAKER_FEE : 0;

  // Recomputing the EIP-712 digest as the user types is what makes the viem
  // integration visible rather than decorative.
  const previewDigest = useMemo(
    () =>
      hashOrderIntent({
        coin: market.coin,
        side,
        notional: toBaseUnits(notional || '0'),
        limitPx: price.toString(),
        nonce: 0n,
      }),
    [market.coin, side, notional, price],
  );

  const applyPreset = (index: number) => {
    const fraction = PRESETS[index]!.fraction;
    // Floor to the cent so "Max" can never exceed the balance through rounding.
    const amount = Math.floor(available * fraction * 100) / 100;
    setNotional(amount > 0 ? amount.toFixed(2) : '');
    setPreset(index);
  };

  const ctaLabel = !entered
    ? 'Enter an amount'
    : insufficient
      ? 'Insufficient USDC'
      : `${side === 'buy' ? 'Buy' : 'Sell'} ${market.coin}`;

  return (
    <View className="mt-4">
      <SideToggle value={side} onChange={setSide} />

      <View
        className={`mt-3 rounded-lg border bg-surface px-4 py-3 ${
          insufficient ? 'border-[rgba(251,113,133,0.4)]' : 'border-line border-t-[#FFFFFF1A]'
        }`}
      >
        <View className="flex-row justify-between gap-3">
          <Text className="font-medium text-xs tracking-[0.12px] text-fg-muted">Amount</Text>
          <Text className="shrink font-regular text-xs text-fg-muted" numberOfLines={1}>
            Available <Text className="text-fg-secondary">{formatUsdc(available)} USDC</Text>
          </Text>
        </View>
        <View className="mt-1 h-[54px] flex-row items-center gap-2">
          <TextInput
            value={notional}
            onChangeText={(next) => {
              setNotional(next.replace(/[^0-9.]/g, ''));
              setPreset(null);
            }}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="0"
            placeholderTextColor={colors.placeholder}
            className="h-[54px] flex-1 py-0 font-semibold text-[36px] tracking-[-1.26px] text-fg"
            style={{ fontVariant: ['tabular-nums'] }}
            accessibilityLabel="Order notional in USDC"
            accessibilityHint="Enter the dollar amount to trade"
            testID="notional-input"
          />
          <Text className="mt-2 font-medium text-base text-fg-secondary">USDC</Text>
        </View>
        <Text className={`font-regular text-xs ${insufficient ? 'text-down' : 'text-fg-muted'}`}>
          {insufficient
            ? 'Exceeds available USDC'
            : `≈ ${estimatedSize.toFixed(market.szDecimals)} ${market.coin}`}
        </Text>
      </View>

      <View className="mt-3 flex-row gap-2">
        {PRESETS.map((entry, index) => {
          const active = index === preset;
          return (
            <PressableScale
              key={entry.label}
              onPress={() => applyPreset(index)}
              scaleTo={0.94}
              className="h-8 flex-1 items-center rounded-sm border border-line bg-surface"
              style={active && { borderColor: `${tint}80`, backgroundColor: `${tint}14` }}
              accessibilityLabel={`Use ${entry.label === 'Max' ? 'all' : entry.label} of available balance`}
              accessibilityState={{ selected: active }}
            >
              <Text className="font-medium text-sm text-fg-secondary" style={active && { color: tint }}>{entry.label}</Text>
            </PressableScale>
          );
        })}
      </View>

      <View className="mb-6 mt-3">
        <KeyValue label="Est. fill price" value={`${formatPrice(price)} USDC`} />
        <View className="min-h-8 flex-row items-center justify-between border-t border-[#FFFFFF0D]">
          <Text className="font-regular text-sm text-fg-muted">Max slippage</Text>
          <PressableScale
            onPress={() => setSlippageIndex((index) => (index + 1) % SLIPPAGE_BPS.length)}
            scaleTo={0.94}
            haptic="none"
            className="flex-row items-center gap-1 rounded-xs py-0.5 pl-1.5"
            accessibilityLabel={`Max slippage ${slippageBps / 100} percent`}
            accessibilityHint="Steps through 0.1, 0.5 and 1 percent. Orders that slip further are rejected."
          >
            <Text className="font-medium text-sm text-fg">{slippageBps / 100}%</Text>
            <Icon name="stepper" />
          </PressableScale>
        </View>
        <KeyValue divider label="Trading fee · 0.035%" value={`$${fee.toFixed(2)}`} />
        <KeyValue divider label="Network fee" value="$0.00" accessibilityHint="Hyperliquid orders carry no gas fee." />
        <KeyValue
          divider
          label="Est. size"
          value={entered ? `${estimatedSize.toFixed(market.szDecimals)} ${market.coin}` : '—'}
        />
        <KeyValue divider label="Notional" value={entered ? formatUsd(parsed) : '—'} />
        <KeyValue
          divider
          label="Leverage · funding"
          value={`max ${market.maxLeverage}x · ${(market.fundingRate * 100).toFixed(4)}%`}
        />
        <KeyValue
          divider
          label="EIP-712 digest"
          value={`${previewDigest.slice(0, 10)}…${previewDigest.slice(-6)}`}
          valueStyle={{ fontFamily: fonts.mono, fontSize: 11 }}
          accessibilityHint="Computed locally with viem. This is the payload a wallet would sign."
        />
      </View>

      <HoldToConfirm
        label={ctaLabel}
        tint={tint}
        disabled={!valid}
        onConfirm={() => {
          ordersStore.submit({ coin: market.coin, side, notional, maxSlippageBps: slippageBps });
          setNotional('');
          setPreset(null);
        }}
        accessibilityLabel={
          valid ? `Hold to submit a simulated ${side} order for ${market.coin}` : ctaLabel
        }
        testID="submit-order"
      />
      <Text className="mt-2 text-center font-regular text-caption text-fg-muted">Press and hold to confirm · simulated, nothing is submitted</Text>

      <View className="mt-6">
        <Banner
          tone="warn"
          title="SIMULATED"
          body={`Orders never leave the device and draw on a ${formatUsdc(PAPER_BALANCE_USDC)} USDC paper balance. Prices, funding and the settle price are real Hyperliquid data; the fill is local.`}
        />
      </View>

      <SectionTitle hint={`${orders.length} in session`}>Recent orders</SectionTitle>
      <OrderList orders={orders} />
    </View>
  );
}
