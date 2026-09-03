import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Jet } from '../jet.js';
import type {
  JetRequestOptions,
  JetResponse,
  MoonlightPayload,
  MoonlightResponse,
  RequestStateSnapshot,
} from '../types.js';

export interface UseJetRequestResult<T> {
  data: T | null;
  error: unknown | null;
  loading: boolean;
  status: RequestStateSnapshot['status'];
  refetch: () => Promise<JetResponse<T> | undefined>;
  abort: () => void;
}

/**
 * React hook that tracks a Jet GET (or custom runner) with loading/error/data state.
 */
export function useJetRequest<T = unknown>(
  jet: Jet,
  url: string,
  options?: JetRequestOptions & { enabled?: boolean; secure?: boolean },
): UseJetRequestResult<T> {
  const requestKey = options?.requestKey ?? `hook:${url}`;
  const enabled = options?.enabled ?? true;
  const [tick, setTick] = useState(0);
  const abortRef = useRef<() => void>(() => undefined);

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      return jet.on('request:change', (snap) => {
        if (snap.id === requestKey) onStoreChange();
      });
    },
    [jet, requestKey],
  );

  const getSnapshot = useCallback(() => {
    return jet.getRequestState(requestKey) ?? idleSnapshot(requestKey);
  }, [jet, requestKey, tick]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const refetch = useCallback(async () => {
    if (!enabled) return undefined;
    const runner = options?.secure ? jet.gets.bind(jet) : jet.get.bind(jet);
    return runner<T>(url, options?.headers, { ...options, requestKey });
  }, [enabled, jet, options, requestKey, url]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        await refetch();
      } catch {
        // state tracker already recorded error
      }
      if (!cancelled) setTick((t) => t + 1);
    })();
    abortRef.current = () => jet.abort(requestKey);
    return () => {
      cancelled = true;
      jet.abort(requestKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, url, requestKey]);

  return {
    data: (snapshot.data as T | null) ?? null,
    error: snapshot.error,
    loading: snapshot.loading,
    status: snapshot.status,
    refetch,
    abort: () => abortRef.current(),
  };
}

export interface UseMoonlightResult<T> {
  data: MoonlightResponse<T> | null;
  error: unknown | null;
  loading: boolean;
  status: RequestStateSnapshot['status'];
  execute: (
    payload?: MoonlightPayload,
    version?: string,
  ) => Promise<MoonlightResponse<T> | unknown>;
  abort: () => void;
}

/**
 * React hook helper for Moonlight requests with loading state.
 */
export function useMoonlight<T = unknown>(
  jet: Jet,
  options?: { requestKey?: string; secure?: boolean; version?: string },
): UseMoonlightResult<T> {
  const requestKey = options?.requestKey ?? 'hook:moonlight';
  const [snapshot, setSnapshot] = useState<RequestStateSnapshot>(idleSnapshot(requestKey));

  useEffect(() => {
    return jet.on('request:change', (snap) => {
      if (snap.id === requestKey) setSnapshot(snap);
    });
  }, [jet, requestKey]);

  const execute = useCallback(
    async (payload: MoonlightPayload = {}, version?: string) => {
      const fn = options?.secure ? jet.secureMoonlightRequest.bind(jet) : jet.moonlightRequest.bind(jet);
      return fn<T>(payload, version ?? options?.version, undefined, undefined, { requestKey });
    },
    [jet, options?.secure, options?.version, requestKey],
  );

  return {
    data: (snapshot.data as MoonlightResponse<T> | null) ?? null,
    error: snapshot.error,
    loading: snapshot.loading,
    status: snapshot.status,
    execute,
    abort: () => jet.abort(requestKey),
  };
}

function idleSnapshot(id: string): RequestStateSnapshot {
  return {
    id,
    status: 'idle',
    loading: false,
    data: null,
    error: null,
    attempt: 0,
  };
}
