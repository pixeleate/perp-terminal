import { useCallback, useEffect, useState } from 'react';

import { fetchMarkets } from '@/lib/hyperliquid/client';
import type { Market } from '@/lib/hyperliquid/types';
import { captureException } from '@/lib/observability/sentry';
import { tickStore } from '@/lib/store/tickStore';

export type MarketsState = {
  markets: Market[];
  loading: boolean;
  refreshing: boolean;
  error?: string;
  refresh: () => void;
};

/** Last successful fetch, shared with the detail screen. */
let cache: Market[] = [];

/** Called by the list so detail navigation is a cache hit rather than a round trip. */
export function primeMarketCache(markets: Market[]): void {
  cache = markets;
}

type Result = { markets: Market[]; error?: string };

/**
 * REST supplies the static half of a market (leverage, size decimals, 24h
 * volume) plus a price snapshot; prices then come from the websocket. So this
 * refetches only on mount and pull-to-refresh, never on a tick.
 *
 * State is written once per request, after the await — the effect never sets
 * state synchronously, which keeps it out of React's cascading-render path.
 */
export function useMarkets(): MarketsState {
  const [result, setResult] = useState<Result>();
  const [reloadToken, setReloadToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const markets = await fetchMarkets(controller.signal);
        if (controller.signal.aborted) return;
        primeMarketCache(markets);
        // Seed the tick store so rows show a price immediately, before the
        // socket's first frame lands.
        tickStore.seed(markets.map((market) => ({ coin: market.coin, px: market.midPx })));
        setResult({ markets });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResult({
          markets: cache,
          error: cause instanceof Error ? cause.message : 'Failed to load markets',
        });
        captureException(cause, { screen: 'markets' });
      } finally {
        if (!controller.signal.aborted) setRefreshing(false);
      }
    })();

    return () => controller.abort();
  }, [reloadToken]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setReloadToken((token) => token + 1);
  }, []);

  return {
    markets: result?.markets ?? [],
    loading: result === undefined,
    refreshing,
    error: result?.error,
    refresh,
  };
}

/* -------------------------------------------------------------------------- */

/**
 * The detail screen is usually reached from the list, so the metadata is
 * already in memory. Only a cold deep link pays for a request.
 */
export function useMarket(coin: string): { market?: Market; loading: boolean; error?: string } {
  const cached = cache.find((entry) => entry.coin === coin);
  const [fetched, setFetched] = useState<{ market?: Market; error?: string }>();

  useEffect(() => {
    if (cached) return;
    const controller = new AbortController();

    (async () => {
      try {
        const markets = await fetchMarkets(controller.signal);
        if (controller.signal.aborted) return;
        primeMarketCache(markets);
        tickStore.seed(markets.map((entry) => ({ coin: entry.coin, px: entry.midPx })));
        const found = markets.find((entry) => entry.coin === coin);
        setFetched({
          market: found,
          error: found ? undefined : `Market "${coin}" not found on Hyperliquid`,
        });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setFetched({
          error: cause instanceof Error ? cause.message : 'Failed to load market',
        });
        captureException(cause, { screen: 'market-detail', coin });
      }
    })();

    return () => controller.abort();
  }, [coin, cached]);

  if (cached) return { market: cached, loading: false };
  return { market: fetched?.market, loading: fetched === undefined, error: fetched?.error };
}
