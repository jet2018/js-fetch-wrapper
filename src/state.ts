import type { JetEventMap, JetEventName, RequestStateListener, RequestStateSnapshot, RequestStatus } from './types.js';

type Listener<T> = (payload: T) => void;

export class RequestStateTracker {
  private snapshots = new Map<string, RequestStateSnapshot>();
  private listeners = new Map<JetEventName, Set<Listener<unknown>>>();
  private globalListeners = new Set<RequestStateListener>();
  private counter = 0;

  constructor(onStateChange?: RequestStateListener) {
    if (onStateChange) {
      this.globalListeners.add(onStateChange);
    }
  }

  createId(requestKey?: string): string {
    if (requestKey) return requestKey;
    this.counter += 1;
    return `jet-${Date.now()}-${this.counter}`;
  }

  onStateChange(listener: RequestStateListener): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  on<E extends JetEventName>(event: E, listener: Listener<JetEventMap[E]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>);
    return () => this.listeners.get(event)?.delete(listener as Listener<unknown>);
  }

  get(id: string): RequestStateSnapshot | undefined {
    return this.snapshots.get(id);
  }

  get isLoading(): boolean {
    for (const snap of this.snapshots.values()) {
      if (snap.loading) return true;
    }
    return false;
  }

  list(): RequestStateSnapshot[] {
    return [...this.snapshots.values()];
  }

  start(partial: Pick<RequestStateSnapshot, 'id' | 'url' | 'method'> & { attempt?: number }): RequestStateSnapshot {
    const snapshot: RequestStateSnapshot = {
      id: partial.id,
      status: 'loading',
      loading: true,
      data: null,
      error: null,
      attempt: partial.attempt ?? 0,
      url: partial.url,
      method: partial.method,
      startedAt: Date.now(),
    };
    this.snapshots.set(snapshot.id, snapshot);
    this.emit('request:start', snapshot);
    this.emit('request:change', snapshot);
    return snapshot;
  }

  retry(id: string, attempt: number): RequestStateSnapshot | undefined {
    const current = this.snapshots.get(id);
    if (!current) return undefined;
    const snapshot: RequestStateSnapshot = {
      ...current,
      status: 'loading',
      loading: true,
      attempt,
    };
    this.snapshots.set(id, snapshot);
    this.emit('request:retry', snapshot);
    this.emit('request:change', snapshot);
    return snapshot;
  }

  succeed<T>(id: string, data: T): RequestStateSnapshot<T> {
    const current = this.snapshots.get(id);
    const snapshot: RequestStateSnapshot<T> = {
      id,
      status: 'success',
      loading: false,
      data,
      error: null,
      attempt: current?.attempt ?? 0,
      url: current?.url,
      method: current?.method,
      startedAt: current?.startedAt,
      finishedAt: Date.now(),
    };
    this.snapshots.set(id, snapshot as RequestStateSnapshot);
    this.emit('request:success', snapshot as RequestStateSnapshot);
    this.emit('request:change', snapshot as RequestStateSnapshot);
    return snapshot;
  }

  fail(id: string, error: unknown, status: RequestStatus = 'error'): RequestStateSnapshot {
    const current = this.snapshots.get(id);
    const snapshot: RequestStateSnapshot = {
      id,
      status,
      loading: false,
      data: current?.data ?? null,
      error,
      attempt: current?.attempt ?? 0,
      url: current?.url,
      method: current?.method,
      startedAt: current?.startedAt,
      finishedAt: Date.now(),
    };
    this.snapshots.set(id, snapshot);
    if (status === 'aborted') {
      this.emit('request:aborted', snapshot);
    } else {
      this.emit('request:error', snapshot);
    }
    this.emit('request:change', snapshot);
    return snapshot;
  }

  clear(id?: string): void {
    if (id) {
      this.snapshots.delete(id);
      return;
    }
    this.snapshots.clear();
  }

  private emit<E extends JetEventName>(event: E, payload: JetEventMap[E]): void {
    const set = this.listeners.get(event);
    if (set) {
      for (const listener of set) {
        listener(payload);
      }
    }
    if (event === 'request:change' || event === 'request:start' || event === 'request:success' || event === 'request:error' || event === 'request:aborted' || event === 'request:retry') {
      for (const listener of this.globalListeners) {
        listener(payload as RequestStateSnapshot);
      }
    }
  }
}
