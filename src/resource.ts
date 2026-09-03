import type { Jet } from './jet.js';
import type {
  JetRequestOptions,
  JetResponse,
  MoonlightPayload,
  MoonlightRequestOptions,
  MoonlightResponse,
  RequestStateSnapshot,
} from './types.js';

export interface JetResourceSnapshot<T = unknown> {
  data: T | null;
  error: unknown | null;
  loading: boolean;
  status: RequestStateSnapshot['status'];
  attempt: number;
}

export interface JetResource<T = unknown> {
  readonly key: string;
  /** Current snapshot (framework-agnostic). */
  getSnapshot(): JetResourceSnapshot<T>;
  /** Subscribe to snapshot changes. Returns unsubscribe. */
  subscribe(listener: (snap: JetResourceSnapshot<T>) => void): () => void;
  /** Run / re-run the underlying request. */
  execute(): Promise<T | undefined>;
  abort(): void;
  /** Tear down the Jet event subscription. */
  destroy(): void;
}

function toResourceSnap<T>(snap?: RequestStateSnapshot): JetResourceSnapshot<T> {
  return {
    data: (snap?.data as T | null) ?? null,
    error: snap?.error ?? null,
    loading: snap?.loading ?? false,
    status: snap?.status ?? 'idle',
    attempt: snap?.attempt ?? 0,
  };
}

/**
 * Framework-agnostic reactive request resource.
 * Works with Vue, Angular, Svelte, or plain JS — no React required.
 *
 * @example Vue 3
 * ```ts
 * import { ref, onMounted, onUnmounted } from 'vue';
 * const snap = ref(resource.getSnapshot());
 * const stop = resource.subscribe((s) => { snap.value = s; });
 * onMounted(() => resource.execute());
 * onUnmounted(() => { stop(); resource.destroy(); });
 * ```
 *
 * @example Angular
 * ```ts
 * resource.subscribe((s) => this.zone.run(() => Object.assign(this.vm, s)));
 * await resource.execute();
 * ```
 */
export function createJetResource<T = unknown>(
  jet: Jet,
  options: {
    key: string;
    run: () => Promise<JetResponse<T> | T | MoonlightResponse<T> | unknown>;
  },
): JetResource<T> {
  const key = options.key;
  const listeners = new Set<(snap: JetResourceSnapshot<T>) => void>();

  const notify = () => {
    const snap = toResourceSnap<T>(jet.getRequestState(key));
    for (const listener of listeners) listener(snap);
  };

  const unsubJet = jet.on('request:change', (snap) => {
    if (snap.id === key) notify();
  });

  return {
    key,
    getSnapshot: () => toResourceSnap<T>(jet.getRequestState(key)),
    subscribe(listener) {
      listeners.add(listener);
      listener(toResourceSnap<T>(jet.getRequestState(key)));
      return () => {
        listeners.delete(listener);
      };
    },
    async execute() {
      try {
        const result = await options.run();
        if (result && typeof result === 'object' && 'data' in (result as object) && 'status' in (result as object)) {
          return (result as JetResponse<T>).data;
        }
        return result as T;
      } finally {
        notify();
      }
    },
    abort() {
      jet.abort(key);
    },
    destroy() {
      listeners.clear();
      unsubJet();
    },
  };
}

/** Convenience resource for a GET (or secure GET). */
export function createJetGetResource<T = unknown>(
  jet: Jet,
  url: string,
  options?: JetRequestOptions & { key?: string; secure?: boolean },
): JetResource<T> {
  const key = options?.key ?? options?.requestKey ?? `get:${url}`;
  return createJetResource(jet, {
    key,
    run: () => {
      const runner = options?.secure ? jet.gets.bind(jet) : jet.get.bind(jet);
      return runner<T>(url, options?.headers, { ...options, requestKey: key });
    },
  });
}

/** Convenience resource for Moonlight GET or POST. */
export function createMoonlightResource<T = unknown>(
  jet: Jet,
  payload: MoonlightPayload,
  options?: MoonlightRequestOptions & { key?: string },
): JetResource<MoonlightResponse<T>> {
  const method = options?.method ?? 'POST';
  const key =
    options?.key ??
    options?.requestKey ??
    `moonlight:${method}:${String(payload.service ?? payload.SERVICE)}:${String(payload.action ?? payload.ACTION)}`;
  return createJetResource(jet, {
    key,
    run: () => {
      if (options?.secure) {
        return jet.secureMoonlightRequest<T>(payload, {
          ...options,
          method,
          requestKey: key,
        });
      }
      return jet.moonlightRequest<T>(payload, {
        ...options,
        method,
        requestKey: key,
      });
    },
  });
}
