import type { TokenGetter, TokenStorage } from '../types.js';

/** In-memory storage for Node, tests, and SSR. */
export class MemoryStorage implements TokenStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

/** Browser localStorage adapter — returns null when unavailable. */
export function createLocalStorageAdapter(): TokenStorage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
      return globalThis.localStorage;
    }
  } catch {
    // Access may throw in sandboxed / privacy modes.
  }
  return null;
}

/** Browser sessionStorage adapter. */
export function createSessionStorageAdapter(): TokenStorage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'sessionStorage' in globalThis && globalThis.sessionStorage) {
      return globalThis.sessionStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Wrap React Native AsyncStorage (or any async key-value store) as TokenStorage.
 */
export function createAsyncStorageAdapter(asyncStorage: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}): TokenStorage {
  return {
    getItem: (key: string) => asyncStorage.getItem(key),
    setItem: (key: string, value: string) => asyncStorage.setItem(key, value),
    removeItem: (key: string) => asyncStorage.removeItem(key),
  };
}

export async function resolveToken(options: {
  getToken?: TokenGetter;
  token?: string | null | TokenGetter;
  tokenStorage?: TokenStorage | null;
  tokenBearerKey: string;
}): Promise<string | null> {
  if (options.getToken) {
    const value = await options.getToken();
    return value ?? null;
  }

  if (typeof options.token === 'function') {
    const value = await options.token();
    return value ?? null;
  }

  if (typeof options.token === 'string' && options.token.length > 0) {
    return options.token;
  }

  if (options.tokenStorage) {
    const value = await options.tokenStorage.getItem(options.tokenBearerKey);
    return value ?? null;
  }

  return null;
}
