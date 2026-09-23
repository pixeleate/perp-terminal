import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { AnimatedText } from '@/components/Styled';
import { Banner, ChangeBadge, Skeleton } from '@/components/ui';
import { ChartCard } from '@/features/chart/ChartCard';
import { MiniChart } from '@/features/chart/MiniChart';
import { useCandles } from '@/features/chart/useCandles';
import { OrderBookCard } from '@/features/markets/OrderBookCard';
import { useMarket } from '@/features/markets/useMarkets';
import { useIsWatched, watchlistStore } from '@/features/markets/watchlistStore';
import { formatCompactUsd, formatPrice } from '@/lib/format';
import { useMarketFeed, type FeedStatus } from '@/lib/hyperliquid/feed';
import type { Market } from '@/lib/hyperliquid/types';
import { useTick } from '@/lib/store/tickStore';
import { colors, radius } from '@/lib/theme';

import { TradeTicket } from './TradeTicket';

const FEED_LABEL: Record<FeedStatus, { label: string; color: string }> = {
  idle: { label: 'Paused', color: colors.textMuted },
  connecting: { label: 'Connecting', color: colors.warn },
  live: { label: 'Live', color: colors.up },
  reconnecting: { label: 'Reconnecting', color: colors.warn },
  offline: { label: 'Offline', color: colors.down },
};

/**
 * The trade ticket as a full screen. Rendered by the Trade tab (for whatever
 * market was last tapped) and by the `market/[coin]` deep link.
 */
export function TradeScreen({ coin, onBack }: { coin: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { market, loading, error } = useMarket(coin);

  // Keeps the shared websocket alive while this screen is mounted, including
  // when it is deep-linked without passing through the list.
  const feedStatus = useMarketFeed();

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <Header coin={coin} onBack={onBack} />
      <ScrollView
        contentContainerClassName="px-5 pb-16"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {loading && !market ? (
          <HeroSkeleton />
        ) : error || !market ? (
          <Banner tone="warn" title="MARKET UNAVAILABLE" body={error ?? `No data for ${coin}.`} />
        ) : (
          <>
            <Hero market={market} feedStatus={feedStatus} />
            <TradeTicket market={market} />
            <ChartCard coin={market.coin} />
            <OrderBookCard coin={market.coin} />
            <Text className="mt-6 text-center font-regular text-2xs text-fg-faint">
              Market data: Hyperliquid public info API + allMids websocket. Orders: local
              simulation only.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Header({ coin, onBack }: { coin: string; onBack: () => void }) {
  const watched = useIsWatched(coin);

  return (
    <View className="h-11 flex-row items-center justify-between px-3">
      <PressableScale
        onPress={onBack}
        scaleTo={0.9}
        haptic="none"
        className="h-9 w-9 items-center rounded-full"
        accessibilityLabel="Back to markets"
      >
        <Icon name="back" />
      </PressableScale>

      <PressableScale
        onPress={() => router.navigate('/')}
        scaleTo={0.96}
        haptic="none"
        className="h-8 flex-row items-center gap-1.5 rounded-sm px-2"
        accessibilityLabel={`${coin} / USDC. Change market`}
        accessibilityHint="Opens the markets list to pick another pair"
      >
        <Text className="text-md tracking-[-0.24px]">
          <Text className="font-semibold text-fg">{coin}</Text>
          <Text className="font-regular text-fg-muted">/USDC</Text>
        </Text>
        <Icon name="chevronDown" />
      </PressableScale>

      <PressableScale
        onPress={() => watchlistStore.toggle(coin)}
        scaleTo={0.85}
        className="h-9 w-9 items-center rounded-full"
        accessibilityLabel={watched ? `Remove ${coin} from watchlist` : `Add ${coin} to watchlist`}
        accessibilityState={{ selected: watched }}
        testID="watchlist-toggle"
      >
        <Icon name={watched ? 'starFilled' : 'star'} />
      </PressableScale>
    </View>
  );
}

function Hero({ market, feedStatus }: { market: Market; feedStatus: FeedStatus }) {
  const tick = useTick(market.coin);
  // A day of 15m bars: the header chart and the 24h range come from one request.
  const { closes, high, low } = useCandles(market.coin, '15m', 96);
  const price = tick?.px ?? market.midPx;
  const feed = FEED_LABEL[feedStatus];

  // Flash the live price the same way the markets list does, so the number the
  // user is about to trade against visibly updates under their finger.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (!tick || tick.direction === 'flat') return;
    flash.value = withSequence(
      withTiming(tick.direction === 'up' ? 1 : -1, { duration: 90 }),
      withTiming(0, { duration: 520 }),
    );
  }, [tick?.seq, tick?.direction, flash, tick]);

  const priceStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [-1, 0, 1], [colors.down, colors.text, colors.up]),
  }));

  // Swap in the live mid for the last bar so the chart's edge tracks the feed.
  const livePx = tick?.px;
  const series = useMemo(
    () => (closes.length > 0 && livePx !== undefined ? [...closes.slice(0, -1), livePx] : closes),
    [closes, livePx],
  );

  return (
    <View>
      <View className="mt-3 flex-row items-end justify-between gap-3">
        <View className="shrink gap-1">
          <View
            className="flex-row items-center gap-1.5"
            accessible
            accessibilityRole="text"
            accessibilityLabel={`Market data feed is ${feed.label}`}
          >
            <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: feed.color }} />
            <Text className="font-medium text-caption tracking-[0.22px] text-fg-muted">{feed.label} · Hyperliquid</Text>
          </View>
          <View className="mb-1.5 flex-row items-start">
            <Text className="mr-0.5 font-semibold text-[26px] leading-[30px] tracking-[-1.6px] text-fg-secondary">
              $
            </Text>
            <AnimatedText
              className="shrink font-semibold text-hero tracking-[-1.6px]"
              style={[{ fontVariant: ['tabular-nums'] }, priceStyle]}
              numberOfLines={1}
              adjustsFontSizeToFit
              accessibilityLabel={`Live price ${formatPrice(price)} dollars`}
            >
              {formatPrice(price)}
            </AnimatedText>
          </View>
          <ChangeBadge value={market.changePct} size="md" />
        </View>
        <View className="h-[60px] w-[132px]">
          {series.length < 2 ? (
            <Skeleton width={132} height={56} />
          ) : (
            <MiniChart values={series} width={132} height={56} up={market.changePct >= 0} variant="area" />
          )}
        </View>
      </View>

      <View className="mt-4 h-[60px] flex-row items-center border-y border-[#FFFFFF0F]">
        <Stat label="24h High" value={formatPrice(high)} />
        <Stat label="24h Low" value={formatPrice(low)} />
        <Stat label="24h Vol" value={formatCompactUsd(market.dayNtlVlm)} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 gap-0.5" accessible accessibilityRole="text" accessibilityLabel={`${label}: ${value}`}>
      <Text className="font-regular text-xs text-fg-muted">{label}</Text>
      <Text className="font-medium text-xs text-fg" style={{ fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function HeroSkeleton() {
  return (
    <View className="mt-3 flex-row justify-between">
      <View className="shrink gap-1">
        <Skeleton width={96} height={12} />
        <Skeleton width={160} height={36} />
        <Skeleton width={64} height={24} radius={radius.xs} />
      </View>
      <Skeleton width={132} height={56} />
    </View>
  );
}
