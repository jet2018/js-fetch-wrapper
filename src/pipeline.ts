import { AbortRequestError, HttpError, isAbortError, TimeoutError } from './errors.js';
import type { RequestStateTracker } from './state.js';
import type { PipelineInput, JetResponse, RetryPolicy } from './types.js';
import { computeDelay, isIdempotentMethod, parseResponse, sleep } from './utils.js';

function getFetch(): typeof fetch {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('globalThis.fetch is not available. Use Node 18+, a modern browser, or React Native 0.65+.');
  }
  return globalThis.fetch.bind(globalThis);
}

function combineSignals(signals: Array<AbortSignal | null | undefined>): AbortSignal | undefined {
  const active = signals.filter((s): s is AbortSignal => !!s);
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];

  if (typeof AbortSignal !== 'undefined' && 'any' in AbortSignal && typeof AbortSignal.any === 'function') {
    return AbortSignal.any(active);
  }

  const controller = new AbortController();
  const onAbort = () => {
    controller.abort();
    cleanup();
  };
  const cleanup = () => {
    for (const s of active) {
      s.removeEventListener('abort', onAbort);
    }
  };
  for (const s of active) {
    if (s.aborted) {
      controller.abort();
      return controller.signal;
    }
    s.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}

function shouldRetry(error: unknown, method: string, policy: RetryPolicy, response?: Response): boolean {
  if (!isIdempotentMethod(method) && !policy.retryUnsafeMethods) {
    return false;
  }
  if (isAbortError(error) && !(error instanceof TimeoutError)) {
    return false;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  if (response) {
    const statuses = policy.retryOnStatuses ?? [];
    return statuses.includes(response.status);
  }
  // Network / TypeError from fetch
  return true;
}

export async function runPipeline<T = unknown>(
  input: PipelineInput,
  tracker?: RequestStateTracker,
): Promise<JetResponse<T>> {
  const fetchImpl = getFetch();
  const maxAttempts = (input.retry.retries ?? 0) + 1;
  let lastError: unknown;
  let lastResponse: Response | undefined;

  if (!input.silent && tracker) {
    tracker.start({ id: input.requestKey!, url: input.url, method: input.method, attempt: 0 });
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const timeoutController = input.timeout > 0 ? new AbortController() : null;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;

    if (timeoutController && input.timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        timeoutController.abort(new TimeoutError(input.timeout));
      }, input.timeout);
    }

    const signal = combineSignals([input.signal, timeoutController?.signal]);

    try {
      if (signal?.aborted) {
        if (timedOut) throw new TimeoutError(input.timeout);
        throw signal.reason instanceof Error ? signal.reason : new AbortRequestError();
      }

      const response = await fetchImpl(input.url, {
        ...input.init,
        method: input.method,
        headers: input.headers,
        body: input.method.toUpperCase() === 'GET' || input.method.toUpperCase() === 'HEAD' ? undefined : input.body,
        signal,
      });

      lastResponse = response;

      if (!response.ok && shouldRetry(null, input.method, input.retry, response) && attempt < maxAttempts) {
        const delay = computeDelay(attempt, input.retry);
        input.retry.onRetry?.(attempt, new HttpError(response.statusText || `HTTP ${response.status}`, response.status, response));
        if (!input.silent && tracker) {
          tracker.retry(input.requestKey!, attempt);
        }
        await sleep(delay, input.signal);
        continue;
      }

      const data = (await parseResponse(response, input.responseType)) as T;
      const result: JetResponse<T> = {
        response,
        data,
        status: response.status,
        ok: response.ok,
        headers: response.headers,
      };

      if (!input.silent && tracker) {
        tracker.succeed(input.requestKey!, data);
      }
      return result;
    } catch (error) {
      const normalizedError =
        timedOut || error instanceof TimeoutError
          ? error instanceof TimeoutError
            ? error
            : new TimeoutError(input.timeout)
          : error;
      lastError = normalizedError;

      if (isAbortError(normalizedError) && !(normalizedError instanceof TimeoutError)) {
        if (!input.silent && tracker) {
          tracker.fail(input.requestKey!, normalizedError, 'aborted');
        }
        throw normalizedError instanceof Error ? normalizedError : new AbortRequestError();
      }

      const retryable = shouldRetry(normalizedError, input.method, input.retry, lastResponse);
      if (retryable && attempt < maxAttempts) {
        const delay = computeDelay(attempt, input.retry);
        input.retry.onRetry?.(attempt, normalizedError);
        if (!input.silent && tracker) {
          tracker.retry(input.requestKey!, attempt);
        }
        await sleep(delay, input.signal);
        continue;
      }

      if (!input.silent && tracker) {
        tracker.fail(input.requestKey!, normalizedError);
      }
      throw normalizedError;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  if (!input.silent && tracker) {
    tracker.fail(input.requestKey!, lastError);
  }
  throw lastError;
}
