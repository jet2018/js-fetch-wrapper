import type { MoonlightResponse } from './types.js';

type CauseOptions = { cause?: unknown };

export class JetError extends Error {
  name = 'JetError';
  constructor(message: string, options?: CauseOptions) {
    super(message);
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export class HttpError extends JetError {
  name = 'HttpError';
  readonly status: number;
  readonly response: Response;
  readonly data: unknown;

  constructor(message: string, status: number, response: Response, data?: unknown) {
    super(message, { cause: data });
    this.status = status;
    this.response = response;
    this.data = data;
  }
}

export class TimeoutError extends JetError {
  name = 'TimeoutError';
  readonly timeout: number;

  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.timeout = timeout;
  }
}

export class AbortRequestError extends JetError {
  name = 'AbortRequestError';

  constructor(message = 'Request was aborted') {
    super(message);
  }
}

export class MoonLightError extends JetError {
  name = 'MoonLightError';
  readonly returnCode?: number;
  readonly payload?: Partial<MoonlightResponse>;

  constructor(
    message: string,
    options?: CauseOptions & { returnCode?: number; payload?: Partial<MoonlightResponse> },
  ) {
    super(message, options);
    this.returnCode = options?.returnCode;
    this.payload = options?.payload;
    if (options?.payload && options.cause === undefined) {
      (this as { cause?: unknown }).cause = options.payload;
    }
  }
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof AbortRequestError) return true;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
    return true;
  }
  if (error instanceof Error && error.name === 'AbortError') return true;
  return false;
}
