import type { BackoffStrategy, ResponseType, RetryPolicy } from './types.js';

const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE']);

export function joinUrl(baseUrl: string | null | undefined, url: string | undefined): string {
  if (!url) {
    if (!baseUrl) {
      throw new Error('Request url undefined; define baseUrl or pass an absolute url');
    }
    return baseUrl;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (!baseUrl) {
    return url;
  }

  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export function appendParams(
  url: string,
  params?: Record<string, string | number | boolean | null | undefined>,
): string {
  if (!params) return url;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (entries.length === 0) return url;

  const usp = new URLSearchParams();
  for (const [key, value] of entries) {
    usp.append(key, String(value));
  }
  const qs = usp.toString();
  if (!qs) return url;
  return url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
}

export function mergeHeaders(...parts: Array<HeadersInit | undefined | null>): Headers {
  const headers = new Headers();
  for (const part of parts) {
    if (!part) continue;
    const h = new Headers(part);
    h.forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

export function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

export function isBodyInit(body: unknown): body is BodyInit {
  if (body == null) return false;
  if (typeof body === 'string') return true;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return true;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return true;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return true;
  if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return true;
  if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body)) return true;
  if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) return true;
  return false;
}

export function serializeBody(body: unknown): BodyInit | null {
  if (body == null) return null;
  if (isBodyInit(body)) return body;
  return JSON.stringify(body);
}

export function shouldSetJsonContentType(body: unknown, headers: Headers): boolean {
  if (headers.has('Content-Type') || headers.has('content-type')) return false;
  if (body == null) return false;
  if (typeof FormData !== 'undefined' && body instanceof FormData) return false;
  if (typeof Blob !== 'undefined' && body instanceof Blob) return false;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return false;
  if (isBodyInit(body) && typeof body !== 'string') return false;
  return true;
}

export async function parseResponse(response: Response, responseType: ResponseType): Promise<unknown> {
  if (responseType === 'auto') {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return parseJsonSafe(response);
    }
    if (contentType.includes('text/') || contentType === '') {
      return response.text();
    }
    return response.blob();
  }

  if (responseType === 'json') {
    return parseJsonSafe(response);
  }
  if (responseType === 'text') {
    return response.text();
  }
  if (responseType === 'blob') {
    return response.blob();
  }
  if (responseType === 'arrayBuffer') {
    return response.arrayBuffer();
  }
  return parseJsonSafe(response);
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function mergeRetry(base?: RetryPolicy | false, override?: RetryPolicy | false): RetryPolicy {
  if (override === false) {
    return { retries: 0 };
  }
  const normalizedBase: RetryPolicy = base === false ? { retries: 0 } : base ?? {};
  const statuses = override?.retryOnStatuses ?? normalizedBase.retryOnStatuses ?? [408, 429, 500, 502, 503, 504];
  return {
    retries: 0,
    retryDelay: 300,
    backoff: 'exponential',
    maxDelay: 10_000,
    retryUnsafeMethods: false,
    ...normalizedBase,
    ...override,
    retryOnStatuses: statuses,
  };
}

export function computeDelay(attempt: number, policy: RetryPolicy): number {
  const base = policy.retryDelay ?? 300;
  const strategy: BackoffStrategy = policy.backoff ?? 'exponential';
  const max = policy.maxDelay ?? 10_000;
  let delay = base;
  if (strategy === 'none') delay = 0;
  else if (strategy === 'fixed') delay = base;
  else delay = base * Math.pow(2, Math.max(0, attempt - 1));

  // Full jitter
  const jittered = delay <= 0 ? 0 : Math.floor(Math.random() * (delay + 1));
  return Math.min(jittered || delay, max);
}

export function isIdempotentMethod(method: string): boolean {
  return IDEMPOTENT.has(method.toUpperCase());
}

export function sleep(ms: number, signal?: AbortSignal | null): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error('Aborted'));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(signal?.reason ?? new Error('Aborted'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function normalizeMoonlightKeys(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...data };
  const serviceKey = Object.keys(out).find((k) => k.toUpperCase() === 'SERVICE');
  const actionKey = Object.keys(out).find((k) => k.toUpperCase() === 'ACTION');
  if (serviceKey && serviceKey !== 'SERVICE' && serviceKey !== 'service') {
    // keep as-is; detection is case-insensitive
  }
  if (actionKey && actionKey !== 'ACTION' && actionKey !== 'action') {
    // keep as-is
  }
  return out;
}

export function hasServiceAndAction(data: object): { ok: true } | { ok: false; missing: 'service' | 'action' } {
  const keys = Object.keys(data as Record<string, unknown>);
  const hasService = keys.some((k) => k.toUpperCase() === 'SERVICE');
  const hasAction = keys.some((k) => k.toUpperCase() === 'ACTION');
  if (!hasService) return { ok: false, missing: 'service' };
  if (!hasAction) return { ok: false, missing: 'action' };
  return { ok: true };
}
