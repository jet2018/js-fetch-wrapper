import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Jet, MemoryStorage, MoonLightError, TimeoutError } from '../src/index.js';
import { joinUrl, appendParams, mergeRetry, computeDelay, hasServiceAndAction } from '../src/utils.js';

function mockFetchSequence(
  handlers: Array<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response>,
) {
  let i = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const handler = handlers[Math.min(i, handlers.length - 1)]!;
    i += 1;
    return handler(input, init);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('utils', () => {
  it('joins base urls without truncating paths', () => {
    expect(joinUrl('https://api.test/api/', '/users')).toBe('https://api.test/api/users');
    expect(joinUrl('https://api.test/api', 'users')).toBe('https://api.test/api/users');
    expect(joinUrl(null, 'https://abs.test/x')).toBe('https://abs.test/x');
  });

  it('appends query params', () => {
    expect(appendParams('https://a.test/x', { q: '1', skip: null })).toBe('https://a.test/x?q=1');
  });

  it('detects moonlight service/action keys case-insensitively', () => {
    expect(hasServiceAndAction({ service: 'a', action: 'b' })).toEqual({ ok: true });
    expect(hasServiceAndAction({ SERVICE: 'a', ACTION: 'b' })).toEqual({ ok: true });
    expect(hasServiceAndAction({ service: 'a' })).toEqual({ ok: false, missing: 'action' });
  });

  it('merges retry policies', () => {
    expect(mergeRetry({ retries: 2 }, { retries: 5 }).retries).toBe(5);
    expect(mergeRetry(undefined, false).retries).toBe(0);
  });

  it('computes bounded delay', () => {
    const delay = computeDelay(3, { retryDelay: 100, backoff: 'fixed', maxDelay: 50 });
    expect(delay).toBeLessThanOrEqual(50);
  });
});

describe('Jet HTTP', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('performs GET and returns typed data', async () => {
    const fetchMock = mockFetchSequence([() => jsonResponse({ ok: true })]);
    const jet = new Jet({ baseUrl: 'https://api.test/api/', tokenStorage: new MemoryStorage() });
    const res = await jet.get<{ ok: boolean }>('users');
    expect(res.data.ok).toBe(true);
    expect(res.status).toBe(200);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('https://api.test/api/users');
  });

  it('does not leak headers across requests', async () => {
    const seen: string[] = [];
    mockFetchSequence([
      (_u, init) => {
        seen.push(new Headers(init?.headers).get('X-One') || '');
        return jsonResponse({});
      },
      (_u, init) => {
        seen.push(new Headers(init?.headers).get('X-One') || 'missing');
        return jsonResponse({});
      },
    ]);
    const jet = new Jet({ baseUrl: 'https://api.test/', tokenStorage: new MemoryStorage() });
    await jet.get('a', { 'X-One': 'yes' });
    await jet.get('b');
    expect(seen[0]).toBe('yes');
    expect(seen[1]).toBe('missing');
  });

  it('attaches Authorization on secure methods using getToken', async () => {
    let auth: string | null = null;
    mockFetchSequence([
      (_u, init) => {
        auth = new Headers(init?.headers).get('Authorization');
        return jsonResponse({ hi: 1 });
      },
    ]);
    const jet = new Jet({
      baseUrl: 'https://api.test/',
      getToken: async () => 'abc123',
      sendTokenAs: 'Bearer',
    });
    await jet.posts('login', { x: 1 });
    expect(auth).toBe('Bearer abc123');
  });

  it('supports FormData without forcing JSON content-type', async () => {
    let contentType: string | null = null;
    mockFetchSequence([
      (_u, init) => {
        contentType = new Headers(init?.headers).get('Content-Type');
        return jsonResponse({ ok: true });
      },
    ]);
    const jet = new Jet({ baseUrl: 'https://api.test/', tokenStorage: new MemoryStorage() });
    const fd = new FormData();
    fd.append('file', 'data');
    await jet.post('upload', fd);
    expect(contentType).toBeNull();
  });

  it('parses empty JSON bodies as null', async () => {
    mockFetchSequence([
      () =>
        new Response('', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ]);
    const jet = new Jet({ baseUrl: 'https://api.test/', tokenStorage: new MemoryStorage() });
    const res = await jet.get('empty');
    expect(res.data).toBeNull();
  });

  it('tracks request loading state', async () => {
    const states: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    mockFetchSequence([
      async () => {
        await gate;
        return jsonResponse({ done: true });
      },
    ]);
    const jet = new Jet({
      baseUrl: 'https://api.test/',
      tokenStorage: new MemoryStorage(),
      onStateChange: (s) => states.push(s.status),
    });
    const pending = jet.get('x', undefined, { requestKey: 'k1' });
    expect(jet.isLoading).toBe(true);
    release();
    await pending;
    expect(jet.isLoading).toBe(false);
    expect(states).toContain('loading');
    expect(states).toContain('success');
  });

  it('retries failed network GETs', async () => {
    let attempts = 0;
    mockFetchSequence([
      () => {
        attempts += 1;
        if (attempts < 3) throw new TypeError('network down');
        return jsonResponse({ ok: true });
      },
    ]);
    const onRetry = vi.fn();
    const jet = new Jet({
      baseUrl: 'https://api.test/',
      tokenStorage: new MemoryStorage(),
      retry: { retries: 3, retryDelay: 1, backoff: 'none', onRetry },
    });
    const res = await jet.get('retry');
    expect(res.data).toEqual({ ok: true });
    expect(attempts).toBe(3);
    expect(onRetry).toHaveBeenCalled();
  });

  it('times out requests', async () => {
    mockFetchSequence([
      async (_u, init) => {
        await new Promise((resolve, reject) => {
          const signal = init?.signal;
          if (!signal) return resolve(undefined);
          if (signal.aborted) return reject(signal.reason);
          signal.addEventListener('abort', () => reject(signal.reason));
        });
        return jsonResponse({});
      },
    ]);
    const jet = new Jet({
      baseUrl: 'https://api.test/',
      tokenStorage: new MemoryStorage(),
      timeout: 20,
      retry: { retries: 0 },
    });
    await expect(jet.get('slow')).rejects.toBeInstanceOf(TimeoutError);
  });
});

describe('Moonlight', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns payload when returnCode matches success', async () => {
    mockFetchSequence([
      () =>
        jsonResponse({
          returnCode: 0,
          returnMessage: 'ok',
          returnData: { id: 1 },
        }),
    ]);
    const jet = new Jet({ baseUrl: 'https://api.test/api/', tokenStorage: new MemoryStorage() });
    const data = await jet.moonlightRequest<{ id: number }>({ service: 'auth', action: 'login' });
    expect(data).toMatchObject({ returnCode: 0, returnData: { id: 1 } });
  });

  it('throws MoonLightError on business failure', async () => {
    mockFetchSequence([
      () =>
        jsonResponse({
          returnCode: 2,
          returnMessage: 'Invalid credentials',
        }),
    ]);
    const jet = new Jet({ baseUrl: 'https://api.test/api/', tokenStorage: new MemoryStorage() });
    await expect(jet.moonlightRequest({ SERVICE: 'auth', ACTION: 'login' })).rejects.toBeInstanceOf(MoonLightError);
  });

  it('secureMoonlightRequest attaches token', async () => {
    let auth: string | null = null;
    mockFetchSequence([
      (_u, init) => {
        auth = new Headers(init?.headers).get('Authorization');
        return jsonResponse({ returnCode: 0, returnMessage: 'ok' });
      },
    ]);
    const storage = new MemoryStorage();
    storage.setItem('SecretKey', 'tok');
    const jet = new Jet({
      baseUrl: 'https://api.test/api/',
      tokenStorage: storage,
      interceptWithJWTAuth: true,
    });
    await jet.secureMoonlightRequest({ service: 'user', action: 'profile' }, 'v2/');
    expect(auth).toBe('Bearer tok');
  });

  it('uses custom moonlight error handler', async () => {
    mockFetchSequence([() => jsonResponse({ returnCode: 9, returnMessage: 'nope' })]);
    const handler = vi.fn((err) => ({ handled: true, err }));
    const jet = new Jet({
      baseUrl: 'https://api.test/api/',
      tokenStorage: new MemoryStorage(),
      moonlightErrorHandler: handler,
    });
    const result = await jet.moonlightRequest({ service: 'a', action: 'b' });
    expect(handler).toHaveBeenCalled();
    expect(result).toMatchObject({ handled: true });
  });
});

describe('MemoryStorage adapter', () => {
  it('stores tokens', async () => {
    const storage = new MemoryStorage();
    storage.setItem('k', 'v');
    expect(storage.getItem('k')).toBe('v');
    storage.removeItem('k');
    expect(storage.getItem('k')).toBeNull();
  });
});
