import { useCallback, useEffect, useState } from 'react';

import { fetchCandles, type CandleInterval } from '@/lib/hyperliquid/client';
import { captureException } from '@/lib/observability/sentry';

export type CandlesState = {
  closes: number[];
  /** Range over the fetched window — the 24h high/low when asked for a day of bars. */
  high?: number;
  low?: number;
  loading: boolean;
  error?: string;
  reload: () => void;
};

/**
 * `loading` is derived, not stored.
 *
 * Keying the result by the request it came from means the effect never has to
 * flip a loading flag synchronously before awaiting — it only writes state once
 * the response is in hand. Switching interval is instantly "loading" because
 * the cached result no longer matches the requested key.
 */
export function useCandles(coin: string, interval: CandleInterval, bars = 96): CandlesState {
  const requestKey = `${coin}:${interval}:${bars}`;
  const [result, setResult] = useState<{
    key: string;
    closes: number[];
    high?: number;
    low?: number;
    error?: string;
  }>();
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const { closes, high, low } = await fetchCandles(coin, interval, bars, controller.signal);
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          closes,
          high,
          low,
          error: closes.length < 2 ? 'Not enough history for this market' : undefined,
        });
      } catch (cause) {
        if (controller.signal.aborted) return;
        setResult({
          key: requestKey,
          closes: [],
          error: cause instanceof Error ? cause.message : 'Failed to load candles',
        });
        captureException(cause, { screen: 'chart', coin, interval });
      }
    })();

    return () => controller.abort();
  }, [coin, interval, bars, requestKey, reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);
  const fresh = result?.key === requestKey;

  return {
    closes: fresh ? result.closes : [],
    high: fresh ? result.high : undefined,
    low: fresh ? result.low : undefined,
    loading: !fresh,
    error: fresh ? result.error : undefined,
    reload,
  };
}
