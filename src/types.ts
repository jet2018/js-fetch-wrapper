/** Lifecycle status for a tracked request. */
export type RequestStatus = 'idle' | 'loading' | 'success' | 'error' | 'aborted';

/** How to parse the Response body. */
export type ResponseType = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'auto';

/** Backoff strategy for retries. */
export type BackoffStrategy = 'none' | 'fixed' | 'exponential';

/** Token provider — sync or async, portable across web/RN/Node. */
export type TokenGetter = () => string | null | undefined | Promise<string | null | undefined>;

/** Minimal storage contract (localStorage / AsyncStorage / memory). */
export interface TokenStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem?(key: string, value: string): void | Promise<void>;
  removeItem?(key: string): void | Promise<void>;
}

export interface RetryPolicy {
  /** Max retry attempts after the first try. Default: 0 */
  retries?: number;
  /** Base delay in ms. Default: 300 */
  retryDelay?: number;
  /** Backoff mode. Default: 'exponential' */
  backoff?: BackoffStrategy;
  /** Max delay cap in ms. Default: 10_000 */
  maxDelay?: number;
  /** HTTP statuses that should retry. Default: [408, 429, 500, 502, 503, 504] */
  retryOnStatuses?: number[];
  /** Retry non-idempotent methods (POST/PATCH/DELETE). Default: false */
  retryUnsafeMethods?: boolean;
  /** Called before each retry sleep. */
  onRetry?: (attempt: number, error: unknown) => void;
}

export interface RequestStateSnapshot<T = unknown> {
  id: string;
  status: RequestStatus;
  loading: boolean;
  data: T | null;
  error: unknown | null;
  attempt: number;
  url?: string;
  method?: string;
  startedAt?: number;
  finishedAt?: number;
}

export type RequestStateListener = (state: RequestStateSnapshot) => void;

export type JetEventMap = {
  'request:start': RequestStateSnapshot;
  'request:success': RequestStateSnapshot;
  'request:error': RequestStateSnapshot;
  'request:aborted': RequestStateSnapshot;
  'request:retry': RequestStateSnapshot & { attempt: number };
  'request:change': RequestStateSnapshot;
};

export type JetEventName = keyof JetEventMap;

export interface JetRequestOptions extends Omit<RequestInit, 'body' | 'headers' | 'method' | 'signal'> {
  headers?: HeadersInit;
  /** Override global timeout for this request (ms). */
  timeout?: number;
  /** Override global retry policy. */
  retry?: RetryPolicy | false;
  /** How to parse the body. Default: 'json' */
  responseType?: ResponseType;
  /** AbortSignal from the caller. */
  signal?: AbortSignal | null;
  /** Track this request under a stable key (for state/dedupe). */
  requestKey?: string;
  /** Skip emitting request-state events. */
  silent?: boolean;
  /** Force attach auth token. */
  secure?: boolean;
  /** Query string params appended to the URL. */
  params?: Record<string, string | number | boolean | null | undefined>;
}

export interface JetResponse<T = unknown> {
  response: Response;
  data: T;
  status: number;
  ok: boolean;
  headers: Headers;
}

export interface MoonlightPayload {
  service?: string;
  action?: string;
  SERVICE?: string;
  ACTION?: string;
  [key: string]: unknown;
}

export interface MoonlightResponse<T = unknown> {
  returnCode: number;
  returnMessage?: string | null;
  returnData?: T | null;
  returnObject?: T | null;
  extraData?: unknown;
  [key: string]: unknown;
}

export type MoonlightErrorHandler = (
  error: Partial<MoonlightResponse> & { returnMessage?: string | null; returnCode?: number },
) => unknown;

export interface Configuration {
  baseUrl?: string | null;
  /** Prefer getToken; kept for 1.x compatibility. */
  token?: string | null | TokenGetter;
  /** Async/sync token resolver — preferred over localStorage. */
  getToken?: TokenGetter;
  /** Storage used when getToken/token are not provided. */
  tokenStorage?: TokenStorage;
  /** Key used with tokenStorage. Default: 'SecretKey' */
  tokenBearerKey?: string;
  /** Authorization scheme prefix. Default: 'Bearer' */
  sendTokenAs?: string;
  /** When true, secure methods attach Authorization. Default: true if getToken/token/storage set. */
  interceptWithJWTAuth?: boolean;
  defaultHeaders?: HeadersInit;
  /** Browser cache hint for GET. Default: true */
  cachable?: boolean;
  /** Default request timeout in ms. 0 = none. Default: 0 */
  timeout?: number;
  /** Default retry policy. */
  retry?: RetryPolicy;
  /** Default body parser. Default: 'json' */
  responseType?: ResponseType;
  /** Moonlight success returnCode. Default: 0 */
  moonlightSuccessCode?: number;
  /** Custom moonlight error handler (suppresses throw when set). */
  moonlightErrorHandler?: MoonlightErrorHandler;
  /** @deprecated typo alias for moonlightErrorHandler */
  moonlightErrorhandler?: MoonlightErrorHandler;
  /** Internal transport error code for moonlight. Default: success + 1000 */
  internalErrorCode?: number;
  /** Default moonlight API version path. Default: 'v1/' */
  defaultMoonlightVersion?: string;
  /** Global state change listener. */
  onStateChange?: RequestStateListener;
}

export interface PipelineInput {
  url: string;
  method: string;
  body?: BodyInit | null;
  headers: Headers;
  init: RequestInit;
  responseType: ResponseType;
  timeout: number;
  retry: RetryPolicy;
  signal?: AbortSignal | null;
  requestKey?: string;
  silent?: boolean;
}
