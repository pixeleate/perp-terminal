import { useEffect, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { env } from '@/lib/env';
import { toNumber } from '@/lib/format';
import { tickStore } from '@/lib/store/tickStore';

import type { HlWsMessage } from './types';

export type FeedStatus = 'idle' | 'connecting' | 'live' | 'reconnecting' | 'offline';

type Listener = () => void;

const PING_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 15_000;

/**
 * A single shared websocket to Hyperliquid's `allMids` channel.
 *
 * Reference-counted: screens call `retain()` on mount and the returned release
 * on unmount, so navigating Markets → Chart → Markets reuses one socket instead
 * of opening three. The socket also closes when the app backgrounds, which
 * matters a lot on mobile — an open socket in the background burns battery and
 * gets killed by the OS anyway.
 */
class MarketFeed {
  private socket: WebSocket | null = null;
  private status: FeedStatus = 'idle';
  private readonly listeners = new Set<Listener>();
  private refCount = 0;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private appStateSub: { remove: () => void } | null = null;
  private lastMessageAt = 0;

  getStatus = (): FeedStatus => this.status;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  retain = (): (() => void) => {
    this.refCount += 1;
    if (this.refCount === 1) {
      this.appStateSub = AppState.addEventListener('change', this.handleAppState);
      this.open();
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.refCount -= 1;
      if (this.refCount <= 0) {
        this.refCount = 0;
        this.appStateSub?.remove();
        this.appStateSub = null;
        this.close('idle');
      }
    };
  };

  private setStatus = (next: FeedStatus): void => {
    if (this.status === next) return;
    this.status = next;
    this.listeners.forEach((listener) => listener());
  };

  private handleAppState = (state: AppStateStatus): void => {
    if (state === 'active') {
      if (this.refCount > 0 && !this.socket) this.open();
    } else {
      this.close('idle');
    }
  };

  private open = (): void => {
    if (this.socket) return;
    this.setStatus(this.attempt === 0 ? 'connecting' : 'reconnecting');

    let socket: WebSocket;
    try {
      socket = new WebSocket(env.hyperliquidWsUrl);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      this.lastMessageAt = Date.now();
      this.setStatus('live');
      socket.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'allMids' } }));
      this.pingTimer = setInterval(() => {
        // Hyperliquid drops idle sockets after ~60s of silence.
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ method: 'ping' }));
        }
      }, PING_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      this.lastMessageAt = Date.now();
      let message: HlWsMessage;
      try {
        message = JSON.parse(String(event.data)) as HlWsMessage;
      } catch {
        return;
      }
      if (message.channel !== 'allMids') return;

      const raw = (message as { data?: { mids?: Record<string, string> } }).data?.mids;
      if (!raw) return;

      const mids: Record<string, number> = {};
      for (const coin in raw) {
        // Hyperliquid also streams spot pairs keyed as "@123" and index
        // products as "#456". The perps screen only cares about named coins.
        if (coin.startsWith('@') || coin.startsWith('#')) continue;
        const px = toNumber(raw[coin]);
        if (px !== undefined) mids[coin] = px;
      }
      tickStore.applyMids(mids, this.lastMessageAt);
    };

    socket.onerror = () => {
      // `onclose` always follows, which is where reconnection is handled.
    };

    socket.onclose = () => {
      this.clearTimers();
      this.socket = null;
      if (this.refCount > 0 && AppState.currentState === 'active') {
        this.scheduleReconnect();
      } else {
        this.setStatus('idle');
      }
    };
  };

  private scheduleReconnect = (): void => {
    this.setStatus(this.attempt === 0 ? 'offline' : 'reconnecting');
    this.attempt += 1;
    // Exponential backoff with jitter, capped — a thundering herd of retries
    // against a rate-limited API is worse than waiting.
    const base = Math.min(MAX_BACKOFF_MS, 500 * 2 ** (this.attempt - 1));
    const delay = base * (0.7 + Math.random() * 0.6);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.refCount > 0) this.open();
    }, delay);
  };

  private clearTimers = (): void => {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  };

  private close = (status: FeedStatus): void => {
    this.clearTimers();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      try {
        socket.close();
      } catch {
        // Already closing — nothing to do.
      }
    }
    this.setStatus(status);
  };
}

export const marketFeed = new MarketFeed();

/** Keeps the shared feed alive for the lifetime of the calling screen. */
export function useMarketFeed(): FeedStatus {
  useEffect(() => marketFeed.retain(), []);
  return useSyncExternalStore(
    marketFeed.subscribe,
    marketFeed.getStatus,
    marketFeed.getStatus,
  );
}
