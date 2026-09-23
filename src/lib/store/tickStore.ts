import { useCallback, useSyncExternalStore } from 'react';

export type TickDirection = 'up' | 'down' | 'flat';

export type Tick = {
  coin: string;
  px: number;
  prevPx: number;
  direction: TickDirection;
  /** Increments on every accepted update — lets animations retrigger on equal prices. */
  seq: number;
  at: number;
};

type Listener = () => void;

/**
 * A per-key external store.
 *
 * The naive version of this screen keeps `Record<coin, price>` in React state
 * and re-renders all 200+ rows on every websocket frame — Hyperliquid pushes
 * `allMids` several times a second. Here each row subscribes only to its own
 * coin, so a BTC tick re-renders exactly one row. Everything else is untouched.
 */
class TickStore {
  private readonly ticks = new Map<string, Tick>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private readonly anyListeners = new Set<Listener>();

  subscribe = (coin: string, listener: Listener): (() => void) => {
    let bucket = this.listeners.get(coin);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(coin, bucket);
    }
    bucket.add(listener);
    return () => {
      bucket.delete(listener);
      if (bucket.size === 0) this.listeners.delete(coin);
    };
  };

  subscribeAny = (listener: Listener): (() => void) => {
    this.anyListeners.add(listener);
    return () => {
      this.anyListeners.delete(listener);
    };
  };

  /** Stable object identity between updates — required by useSyncExternalStore. */
  getTick = (coin: string): Tick | undefined => this.ticks.get(coin);

  getPrice = (coin: string): number | undefined => this.ticks.get(coin)?.px;

  /**
   * Applies a batch of mids. Unchanged prices are skipped entirely so we never
   * notify a listener that has nothing new to render.
   */
  applyMids = (mids: Record<string, number>, at = Date.now()): number => {
    let changed = 0;
    for (const coin in mids) {
      const px = mids[coin];
      if (px === undefined || !Number.isFinite(px) || px <= 0) continue;

      const previous = this.ticks.get(coin);
      if (previous && previous.px === px) continue;

      const prevPx = previous?.px ?? px;
      this.ticks.set(coin, {
        coin,
        px,
        prevPx,
        direction: px > prevPx ? 'up' : px < prevPx ? 'down' : 'flat',
        seq: (previous?.seq ?? 0) + 1,
        at,
      });
      changed += 1;
      this.listeners.get(coin)?.forEach((listener) => listener());
    }
    if (changed > 0) this.anyListeners.forEach((listener) => listener());
    return changed;
  };

  /** Seeds prices from the REST snapshot so rows render before the socket opens. */
  seed = (entries: { coin: string; px: number }[]): void => {
    const mids: Record<string, number> = {};
    for (const entry of entries) mids[entry.coin] = entry.px;
    this.applyMids(mids);
  };

  reset = (): void => {
    this.ticks.clear();
  };
}

export const tickStore = new TickStore();

/** Subscribes a component to exactly one coin's price. */
export function useTick(coin: string): Tick | undefined {
  const subscribe = useCallback(
    (listener: () => void) => tickStore.subscribe(coin, listener),
    [coin],
  );
  const getSnapshot = useCallback(() => tickStore.getTick(coin), [coin]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
