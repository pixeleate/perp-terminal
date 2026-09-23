import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

import { analytics } from '@/lib/analytics/analytics';

const STORAGE_KEY = 'perpterminal.watchlist.v1';

type Listener = () => void;

/**
 * Starred markets, persisted to AsyncStorage.
 *
 * Kept as a `Set` behind a tiny external store so a row can subscribe to
 * "is my coin starred" without re-rendering when some other coin is toggled.
 */
class WatchlistStore {
  private coins = new Set<string>();
  private readonly listeners = new Set<Listener>();
  private hydrated = false;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    void this.hydrate();
    return () => {
      this.listeners.delete(listener);
    };
  };

  getCoins = (): ReadonlySet<string> => this.coins;

  has = (coin: string): boolean => this.coins.has(coin);

  toggle = (coin: string): void => {
    const next = new Set(this.coins);
    const starred = !next.has(coin);
    if (starred) next.add(coin);
    else next.delete(coin);
    this.coins = next;
    this.notify();
    analytics.capture(starred ? 'watchlist_added' : 'watchlist_removed', { coin });
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => undefined);
  };

  private hydrate = async (): Promise<void> => {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      // Merge rather than replace, in case the user starred something before
      // storage answered.
      this.coins = new Set([...parsed.filter((c): c is string => typeof c === 'string'), ...this.coins]);
      this.notify();
    } catch {
      // A corrupt entry just means an empty watchlist.
    }
  };

  private notify = (): void => {
    this.listeners.forEach((listener) => listener());
  };
}

export const watchlistStore = new WatchlistStore();

export function useWatchlist(): ReadonlySet<string> {
  return useSyncExternalStore(watchlistStore.subscribe, watchlistStore.getCoins, watchlistStore.getCoins);
}

export function useIsWatched(coin: string): boolean {
  const getSnapshot = useCallback(() => watchlistStore.has(coin), [coin]);
  return useSyncExternalStore(watchlistStore.subscribe, getSnapshot, getSnapshot);
}
