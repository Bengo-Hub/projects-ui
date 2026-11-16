'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether a media query matches; undefined on the server and during hydration, when it cannot be
 * known. A layout that must be right on the first paint renders both branches while it is
 * undefined and lets CSS breakpoints pick (see the Gantt page), then keeps only the one in use.
 */
export function useMediaQuery(query: string): boolean | undefined {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', onChange);
      return () => m.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore<boolean | undefined>(
    subscribe,
    () => window.matchMedia(query).matches,
    () => undefined,
  );
}
