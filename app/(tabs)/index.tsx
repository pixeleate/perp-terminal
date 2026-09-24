import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PressableScale } from '@/components/PressableScale';
import { Banner, EmptyState, ScreenTitle } from '@/components/ui';
import { MARKET_ROW_HEIGHT, MarketRow, MarketRowSkeleton } from '@/features/markets/MarketRow';
import { useMarkets } from '@/features/markets/useMarkets';
import { useWatchlist } from '@/features/markets/watchlistStore';
import { selectionStore } from '@/features/trade/selectionStore';
import { analytics } from '@/lib/analytics/analytics';
import { useMarketFeed, type FeedStatus } from '@/lib/hyperliquid/feed';
import type { Market } from '@/lib/hyperliquid/types';
import { colors } from '@/lib/theme';

const STATUS_COPY: Record<FeedStatus, { label: string; color: string }> = {
  idle: { label: 'Paused', color: colors.textMuted },
  connecting: { label: 'Connecting', color: colors.warn },
  live: { label: 'Live', color: colors.up },
  reconnecting: { label: 'Reconnecting', color: colors.warn },
  offline: { label: 'Offline', color: colors.down },
};

type Segment = 'all' | 'watchlist' | 'gainers' | 'losers';

const SEGMENTS: { key: Segment; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'gainers', label: 'Gainers' },
  { key: 'losers', label: 'Losers' },
];

type Sort = 'volume' | 'change' | 'name';

const SORTS: { key: Sort; label: string }[] = [
  { key: 'volume', label: '24h Vol' },
  { key: 'change', label: '24h %' },
  { key: 'name', label: 'A–Z' },
];

const COLUMN_TEXT = 'font-medium text-caption tracking-[0.22px] text-fg-muted';

const SKELETON_ROWS = Array.from({ length: 9 }, (_, index) => index);

function FeedBadge({ status }: { status: FeedStatus }) {
  const { label, color } = STATUS_COPY[status];
  return (
    <View
      className="flex-row items-center gap-1.5"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Market data feed is ${label}`}
    >
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      <Text className="font-medium text-caption tracking-[0.22px] text-fg-muted">{label}</Text>
    </View>
  );
}

export default function MarketsScreen() {
  const insets = useSafeAreaInsets();
  const { markets, loading, refreshing, error, refresh } = useMarkets();
  const feedStatus = useMarketFeed();
  const watchlist = useWatchlist();
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<Segment>('all');
  const [sort, setSort] = useState<Sort>('volume');

  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    let list = needle ? markets.filter((market) => market.coin.toUpperCase().includes(needle)) : markets;

    if (segment === 'watchlist') list = list.filter((market) => watchlist.has(market.coin));
    if (segment === 'gainers') list = list.filter((market) => market.changePct > 0);
    if (segment === 'losers') list = list.filter((market) => market.changePct < 0);

    // Gainers/Losers read as leaderboards, so they rank by move unless the
    // user picked a different sort.
    const effective: Sort = sort === 'volume' && (segment === 'gainers' || segment === 'losers') ? 'change' : sort;
    if (effective === 'volume') return list; // REST already returns volume order.
    const sorted = list.slice();
    if (effective === 'name') sorted.sort((a, b) => a.coin.localeCompare(b.coin));
    else if (segment === 'losers') sorted.sort((a, b) => a.changePct - b.changePct);
    else sorted.sort((a, b) => b.changePct - a.changePct);
    return sorted;
  }, [markets, query, segment, sort, watchlist]);

  // Stable identity: a new closure here would defeat `memo` on every row.
  const openMarket = useCallback((coin: string) => {
    analytics.capture('market_opened', { coin });
    selectionStore.select(coin);
    router.navigate('/trade');
  }, []);

  const cycleSort = useCallback(() => {
    setSort((current) => {
      const next = SORTS[(SORTS.findIndex((entry) => entry.key === current) + 1) % SORTS.length]!.key;
      analytics.capture('markets_sorted', { sort: next });
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Market>) => <MarketRow market={item} onPress={openMarket} />,
    [openMarket],
  );

  const keyExtractor = useCallback((item: Market) => item.coin, []);

  // Every row is the same fixed height, so FlatList can skip measurement
  // entirely — which is what keeps scrolling smooth with 200+ live rows.
  const getItemLayout = useCallback(
    (_data: ArrayLike<Market> | null | undefined, index: number) => ({
      length: MARKET_ROW_HEIGHT,
      offset: MARKET_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const sortLabel = SORTS.find((entry) => entry.key === sort)!.label;
  const initialLoad = loading && markets.length === 0;

  const empty = query.trim() ? (
    <EmptyState title={`No pairs match “${query.trim()}”`} body="Try a ticker like BTC or ETH." />
  ) : segment === 'watchlist' ? (
    <EmptyState title="Your watchlist is empty" body="Star a pair on the trade ticket to pin it here." />
  ) : (
    <EmptyState title="Nothing here right now" body="Pull down to refresh the market list." />
  );

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="gap-4 px-5 pb-3 pt-2">
        <ScreenTitle
          right={
            <View className="flex-row items-center gap-3">
              <FeedBadge status={feedStatus} />
              <PressableScale
                onPress={cycleSort}
                scaleTo={0.92}
                className={`h-9 w-9 items-center rounded-full border ${
                  sort !== 'volume' ? 'border-[#FFFFFF29] bg-raised' : 'border-line-strong bg-surface'
                }`}
                accessibilityLabel={`Sort markets. Currently by ${sortLabel}`}
                accessibilityHint="Cycles between volume, 24 hour change and name"
                testID="markets-sort"
              >
                <Icon name="filter" />
              </PressableScale>
            </View>
          }
        >
          Markets
        </ScreenTitle>

        <View
          className={`h-10 flex-row items-center gap-2 rounded-md border border-[#FFFFFF0F] bg-surface px-3 ${
            initialLoad ? 'opacity-60' : ''
          }`}
        >
          <Icon name="search" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search pairs"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            className="h-full flex-1 py-0 font-regular text-base tracking-[-0.15px] text-fg"
            accessibilityLabel="Search pairs"
            testID="market-search"
          />
          {query ? (
            <PressableScale
              onPress={() => setQuery('')}
              scaleTo={0.85}
              haptic="none"
              className="-mr-[5px] h-6 w-6 items-center"
              accessibilityLabel="Clear search"
            >
              <Icon name="clear" />
            </PressableScale>
          ) : null}
        </View>

        <View className="flex-row gap-1" accessibilityRole="tablist">
          {SEGMENTS.map(({ key, label }) => {
            const active = key === segment;
            return (
              <PressableScale
                key={key}
                onPress={() => {
                  setSegment(key);
                  analytics.capture('markets_segment_changed', { segment: key });
                }}
                scaleTo={0.94}
                haptic="none"
                className={`h-7 items-center rounded-sm px-2.5 ${active ? 'bg-raised' : ''}`}
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                testID={`markets-tab-${key}`}
              >
                <Text
                  className={`font-medium text-sm tracking-[-0.13px] ${active ? 'text-fg' : 'text-fg-muted'}`}
                >
                  {label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View className="flex-row justify-between border-b border-[#FFFFFF0F] px-5 pb-[9px]">
        <Text className={COLUMN_TEXT}>Pair · 24h Vol</Text>
        {sort !== 'volume' ? <Text className={COLUMN_TEXT}>Sorted · {sortLabel}</Text> : null}
        <Text className={COLUMN_TEXT}>Price · 24h</Text>
      </View>

      {error ? (
        <View className="px-5 py-2">
          <Banner tone="warn" title="COULD NOT LOAD MARKETS" body={error} />
        </View>
      ) : null}

      {initialLoad ? (
        <View accessibilityLabel="Loading markets" accessible>
          {SKELETON_ROWS.map((index) => (
            <MarketRowSkeleton key={index} index={index} />
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={8}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerClassName="pb-8"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.textSecondary} />
          }
          ListEmptyComponent={empty}
        />
      )}
    </View>
  );
}
