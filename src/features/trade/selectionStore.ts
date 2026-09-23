import { useCallback, useSyncExternalStore } from 'react';

type Listener = () => void;

const DEFAULT_COIN = 'BTC';

/**
 * Which market the Trade tab has loaded. Tapping a row on Markets writes here;
 * the row reads it back to draw its "selected" marker. Rows subscribe through
 * a boolean selector, so changing the selection re-renders two rows, not all.
 */
class SelectionStore {
  private coin = DEFAULT_COIN;
  private readonly listeners = new Set<Listener>();

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  get = (): string => this.coin;

  select = (coin: string): void => {
    if (coin === this.coin) return;
    this.coin = coin;
    this.listeners.forEach((listener) => listener());
  };
}

export const selectionStore = new SelectionStore();

export function useSelectedCoin(): string {
  return useSyncExternalStore(selectionStore.subscribe, selectionStore.get, selectionStore.get);
}

export function useIsSelected(coin: string): boolean {
  const getSnapshot = useCallback(() => selectionStore.get() === coin, [coin]);
  return useSyncExternalStore(selectionStore.subscribe, getSnapshot, getSnapshot);
}
