import PostHog from 'posthog-react-native';
import { useSyncExternalStore } from 'react';

import { env } from '@/lib/env';

export type AnalyticsEvent = {
  id: number;
  name: string;
  props?: Record<string, unknown>;
  at: number;
  delivered: boolean;
};

type Listener = () => void;

const MAX_LOG = 25;

/**
 * PostHog types properties as JSON-serialisable values. Call sites pass plain
 * records, so widen once here rather than threading a JSON type through every
 * feature module.
 */
type PostHogProps = Parameters<PostHog['capture']>[1];
const asProps = (props?: Record<string, unknown>): PostHogProps => props as PostHogProps;

/**
 * Thin facade over PostHog.
 *
 * Two reasons it exists rather than calling `posthog.capture` from screens:
 * without a key the app must still work (no-op), and the Settings screen shows
 * the last N events so the analytics wiring is demo-able with no dashboard.
 */
class Analytics {
  private client: PostHog | null = null;
  private log: AnalyticsEvent[] = [];
  private readonly listeners = new Set<Listener>();
  private nextId = 1;
  private debug = false;

  init(): void {
    if (this.client || !env.posthogKey) return;
    this.client = new PostHog(env.posthogKey, {
      host: env.posthogHost,
      // Small batches keep the demo responsive; production would leave defaults.
      flushAt: 5,
      flushInterval: 10_000,
    });
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  setDebug(next: boolean): void {
    this.debug = next;
    this.client?.debug(next);
    this.notify();
  }

  get debugEnabled(): boolean {
    return this.debug;
  }

  capture(name: string, props?: Record<string, unknown>): void {
    this.client?.capture(name, asProps(props));
    if (this.debug && __DEV__) console.log('[analytics]', name, props ?? {});
    this.record({ name, props });
  }

  screen(name: string, props?: Record<string, unknown>): void {
    this.client?.screen(name, asProps(props));
    if (this.debug && __DEV__) console.log('[analytics:screen]', name, props ?? {});
    this.record({ name: `$screen:${name}`, props });
  }

  identify(distinctId: string, props?: Record<string, unknown>): void {
    this.client?.identify(distinctId, asProps(props));
    this.record({ name: `$identify:${distinctId}`, props });
  }

  reset(): void {
    this.client?.reset();
    this.record({ name: '$reset' });
  }

  private record(event: { name: string; props?: Record<string, unknown> }): void {
    this.log = [
      {
        id: this.nextId++,
        name: event.name,
        props: event.props,
        at: Date.now(),
        delivered: this.enabled,
      },
      ...this.log,
    ].slice(0, MAX_LOG);
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getLog = (): AnalyticsEvent[] => this.log;
}

export const analytics = new Analytics();

export function useAnalyticsLog(): AnalyticsEvent[] {
  return useSyncExternalStore(analytics.subscribe, analytics.getLog, analytics.getLog);
}
