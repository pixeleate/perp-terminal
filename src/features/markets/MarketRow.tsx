import { memo, useEffect } from 'react';
import { Text, View } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/PressableScale';
import { AnimatedText, AnimatedView } from '@/components/Styled';
import { ChangeBadge, Skeleton } from '@/components/ui';
import { MiniChart } from '@/features/chart/MiniChart';
import { useMiniSeries } from '@/features/chart/useMiniSeries';
import { useIsSelected } from '@/features/trade/selectionStore';
import { formatCompactUsd, formatPercent, formatPrice } from '@/lib/format';
import type { Market } from '@/lib/hyperliquid/types';
import { useTick } from '@/lib/store/tickStore';
import { colors, radius } from '@/lib/theme';

/** 64pt row + 1pt divider. Fixed so the list can skip measurement. */
export const MARKET_ROW_HEIGHT = 65;

const SPARK_W = 56;
const SPARK_H = 24;

type Props = {
  market: Market;
  onPress: (coin: string) => void;
};

/**
 * One row, one subscription.
 *
 * `useTick(coin)` hits a per-key external store, so a BTC frame re-renders the
 * BTC row and nothing else. The row is `memo`'d on `market` (which only changes
 * on pull-to-refresh) and the parent passes a stable `onPress`, so a tick never
 * propagates past this component. Selection and the sparkline are per-coin
 * subscriptions too.
 */
function MarketRowComponent({ market, onPress }: Props) {
  const tick = useTick(market.coin);
  const selected = useIsSelected(market.coin);
  const series = useMiniSeries(market.coin);
  const price = tick?.px ?? market.midPx;

  // -1 → red flash, 0 → resting, 1 → green flash.
  const flash = useSharedValue(0);

  useEffect(() => {
    if (!tick || tick.direction === 'flat') return;
    const target = tick.direction === 'up' ? 1 : -1;
    flash.value = withSequence(
      withTiming(target, { duration: 90 }),
      withTiming(0, { duration: 520 }),
    );
    // `seq` rather than `px` so two identical prices in a row still flash.
  }, [tick?.seq, tick?.direction, flash, tick]);

  const flashStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      flash.value,
      [-1, 0, 1],
      ['rgba(251,113,133,0.16)', 'rgba(251,113,133,0)', 'rgba(52,211,153,0.16)'],
    ),
  }));

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [-1, 0, 1], [colors.down, colors.text, colors.up]),
  }));

  const up = market.changePct >= 0;

  return (
    <PressableScale
      onPress={() => onPress(market.coin)}
      scaleTo={0.985}
      className={`h-[65px] border-b border-line-subtle ${selected ? 'bg-selected' : ''}`}
      accessibilityLabel={`${market.coin} perpetual, ${formatPrice(price)} dollars, ${formatPercent(market.changePct)} in 24 hours`}
      accessibilityHint="Loads this market into the trade ticket"
      accessibilityState={{ selected }}
      testID={`market-row-${market.coin}`}
    >
      {selected ? (
        <View className="absolute left-0 top-3 h-10 w-0.5 rounded-r bg-[rgba(244,244,245,0.7)]" />
      ) : null}
      <View className="flex-row items-center pl-5 pr-3">
        <View className="h-9 w-9 items-center justify-center rounded-full border border-line-strong bg-raised">
          <Text className="font-semibold text-caption tracking-[-0.22px] text-[rgba(244,244,245,0.8)]">
            {market.coin.slice(0, 2).toUpperCase()}
          </Text>
        </View>

        <View className="ml-3 flex-1 gap-0.5">
          <Text className="text-base tracking-[-0.225px]" numberOfLines={1}>
            <Text className="font-semibold text-fg">{market.coin}</Text>
            <Text className="font-regular text-fg-muted">/USDC</Text>
          </Text>
          <Text className="font-regular text-xs text-fg-muted" numberOfLines={1}>
            Vol {formatCompactUsd(market.dayNtlVlm)} · {market.maxLeverage}x
          </Text>
        </View>

        <View className="mx-3 w-14 items-center">
          {series === undefined ? (
            <Skeleton width={SPARK_W} height={20} />
          ) : (
            <MiniChart values={series} width={SPARK_W} height={SPARK_H} up={up} />
          )}
        </View>

        <AnimatedView className="min-w-[104px] items-end gap-1 rounded-sm px-2 py-0.5" style={flashStyle}>
          <AnimatedText
            className="font-medium text-base tracking-[-0.225px]"
            style={[{ fontVariant: ['tabular-nums'] }, priceStyle]}
            numberOfLines={1}
          >
            {formatPrice(price)}
          </AnimatedText>
          <ChangeBadge value={market.changePct} />
        </AnimatedView>
      </View>
    </PressableScale>
  );
}

export const MarketRow = memo(MarketRowComponent);

/** Loading placeholder with the same geometry as a real row. */
export function MarketRowSkeleton({ index }: { index: number }) {
  // Vary the text widths a little so the list doesn't read as a stamped grid.
  const nameW = [84, 78, 92, 80, 74][index % 5]!;
  return (
    <View className="h-[65px] flex-row items-center px-5">
      <Skeleton width={36} height={36} radius={radius.pill} />
      <View className="ml-3 flex-1 gap-2">
        <Skeleton width={nameW} height={12} />
        <Skeleton width={nameW - 20} height={10} />
      </View>
      <Skeleton width={SPARK_W} height={20} className="mx-3" />
      <View className="w-24 items-end gap-2">
        <Skeleton width={70} height={12} />
        <Skeleton width={52} height={16} radius={radius.xs} />
      </View>
    </View>
  );
}
