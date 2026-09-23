import { useCallback, useSyncExternalStore } from 'react';

import { fetchCandles } from '@/lib/hyperliquid/client';

const BARS = 24; // 24 × 1h = the "24h" the row's change badge describes.
const CONCURRENCY = 2;
const TTL_MS = 5 * 60_000;

type Entry = { closes: number[]; at: number };
type Listener = () => void;

/**
 * 24h close series for the markets-list sparklines.
 *
 * There are 200+ rows and Hyperliquid's info endpoint is weight-limited, so a
 * request per row on mount would get rate limited within a scroll. Instead
 * rows register interest while mounted, requests run two at a time, and a
 * queued coin whose row has already scrolled off (no subscribers left) is
 * skipped rather than fetched. Results are cached for five minutes.
 */
class MiniSeriesStore {
  private readonly cache = new Map<string, Entry>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly queue: string[] = [];
  private readonly inFlight = new Set<string>();

  subscribe = (coin: string, listener: Listener): (() => void) => {
    let bucket = this.listeners.get(coin);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(coin, bucket);
    }
    bucket.add(listener);
    this.request(coin);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) this.listeners.delete(coin);
    };
  };

  get = (coin: string): number[] | undefined => this.cache.get(coin)?.closes;

  private request(coin: string): void {
    const cached = this.cache.get(coin);
    if (cached && Date.now() - cached.at < TTL_MS) return;
    if (this.inFlight.has(coin) || this.queue.includes(coin)) return;
    this.queue.push(coin);
    this.pump();
  }

  private pump(): void {
    while (this.inFlight.size < CONCURRENCY && this.queue.length > 0) {
      const coin = this.queue.shift()!;
      if (!this.listeners.has(coin)) continue; // Row left the window before its turn.
      this.inFlight.add(coin);
      void fetchCandles(coin, '1h', BARS)
        .then(({ closes }) => {
          this.cache.set(coin, { closes, at: Date.now() });
          this.listeners.get(coin)?.forEach((listener) => listener());
        })
        .catch(() => {
          // A missing sparkline is cosmetic; cache the miss so we don't hammer
          // the endpoint retrying it on every re-mount.
          this.cache.set(coin, { closes: [], at: Date.now() });
        })
        .finally(() => {
          this.inFlight.delete(coin);
          this.pump();
        });
    }
  }
}

const store = new MiniSeriesStore();

export function useMiniSeries(coin: string): number[] | undefined {
  const subscribe = useCallback((listener: Listener) => store.subscribe(coin, listener), [coin]);
  const getSnapshot = useCallback(() => store.get(coin), [coin]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
