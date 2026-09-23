import * as Sentry from '@sentry/react-native';

import { env } from '@/lib/env';

let initialised = false;

/**
 * Sentry is opt-in. Without a DSN we never call `Sentry.init`, so the SDK
 * installs no error handlers and every helper below becomes a console shim.
 * That keeps a fresh clone quiet instead of throwing "Sentry not configured"
 * at boot.
 */
export function initSentry(): void {
  if (initialised || !env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    // A spike, not production: sample everything so a single test tap shows up.
    tracesSampleRate: 1.0,
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    environment: __DEV__ ? 'development' : 'production',
  });
  Sentry.setTag('surface', 'perp-terminal');
  initialised = true;
}

export const isSentryEnabled = (): boolean => initialised;

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!initialised) {
    if (__DEV__) console.warn('[sentry:noop] exception', error, context);
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMessage(message: string, context?: Record<string, unknown>): void {
  if (!initialised) {
    if (__DEV__) console.warn('[sentry:noop] message', message, context);
    return;
  }
  Sentry.captureMessage(message, context ? { extra: context } : undefined);
}

export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (!initialised) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

/** Wraps the root component for navigation + performance instrumentation. */
export const wrapRoot: typeof Sentry.wrap = (component) =>
  env.sentryDsn ? Sentry.wrap(component) : component;
