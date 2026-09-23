import { usePathname, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { analytics } from './analytics';

/**
 * Expo Router does not emit screen events for you. One hook mounted in the root
 * layout turns every route change into a PostHog `$screen` call, so adding a
 * route never means remembering to add tracking.
 */
export function useScreenTracking(): void {
  const pathname = usePathname();
  const segments = useSegments();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    analytics.screen(pathname, { segments: segments.join('/') });
  }, [pathname, segments]);
}
