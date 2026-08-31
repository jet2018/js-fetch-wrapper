import {
  createLocalStorageAdapter,
  resolveToken,
} from './adapters/storage.js';
import { MoonLightError } from './errors.js';
import { runPipeline } from './pipeline.js';
import { RequestStateTracker } from './state.js';
import type {
  Configuration,
  JetEventMap,
  JetEventName,
  JetRequestOptions,
  JetResponse,
  MoonlightPayload,
  MoonlightResponse,
  RequestStateListener,
  RequestStateSnapshot,
  ResponseType,
  RetryPolicy,
  TokenGetter,
  TokenStorage,
} from './types.js';
import {
  appendParams,
  hasServiceAndAction,
  headersToObject,
  joinUrl,
  mergeHeaders,
  mergeRetry,
  serializeBody,
  shouldSetJsonContentType,
} from './utils.js';

export class Jet {
  baseUrl: string | null;
  token: string | null | TokenGetter;
  getToken?: TokenGetter;
  tokenStorage: TokenStorage | null;
  tokenBearerKey: string;
  sendTokenAs: string;
  interceptWithJWTAuth: boolean;
  defaultHeaders: HeadersInit;
  cachable: boolean;
  timeout: number;
  retry: RetryPolicy;
  responseType: ResponseType;
  moonlightSuccessCode: number;
  moonlightErrorHandler?: Configuration['moonlightErrorHandler'];
  internalErrorCode: number;
  defaultMoonlightVersion: string;

  readonly state: RequestStateTracker;
  private readonly controllers = new Map<string, AbortController>();

  constructor(options: Configuration = {}) {
    this.baseUrl = options.baseUrl ?? null;
    this.token = options.token ?? null;
    this.getToken = options.getToken;
    this.tokenBearerKey = options.tokenBearerKey ?? 'SecretKey';
    this.sendTokenAs = options.sendTokenAs ?? 'Bearer';
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.cachable = options.cachable ?? true;
    this.timeout = options.timeout ?? 0;
    this.retry = mergeRetry(options.retry);
    this.responseType = options.responseType ?? 'json';
    this.moonlightSuccessCode = options.moonlightSuccessCode ?? 0;
    this.moonlightErrorHandler = options.moonlightErrorHandler ?? options.moonlightErrorhandler;
    this.internalErrorCode = options.internalErrorCode ?? this.moonlightSuccessCode + 1000;
    this.defaultMoonlightVersion = options.defaultMoonlightVersion ?? 'v1/';

    this.tokenStorage =
      options.tokenStorage ??
      (options.getToken || options.token ? null : createLocalStorageAdapter());

    const hasAuthSource = !!(options.getToken || options.token || this.tokenStorage);
    this.interceptWithJWTAuth = options.interceptWithJWTAuth ?? hasAuthSource;

    this.state = new RequestStateTracker(options.onStateChange);
  }

  onStateChange(listener: RequestStateListener): () => void {
    return this.state.onStateChange(listener);
  }

  on<E extends JetEventName>(event: E, listener: (payload: JetEventMap[E]) => void): () => void {
    return this.state.on(event, listener);
  }

  get isLoading(): boolean {
    return this.state.isLoading;
  }

  getRequestState(id: string): RequestStateSnapshot | undefined {
    return this.state.get(id);
  }

  /** Abort a tracked in-flight request by key/id. */
  abort(requestKey: string, reason?: unknown): void {
    const controller = this.controllers.get(requestKey);
    if (controller) {
      controller.abort(reason);
      this.controllers.delete(requestKey);
    }
  }

  /** Abort all tracked in-flight requests started with a requestKey. */
  abortAll(reason?: unknown): void {
    for (const [key, controller] of this.controllers) {
      controller.abort(reason);
      this.controllers.delete(key);
    }
  }

  async get<T = unknown>(url?: string, headers?: HeadersInit, config?: JetRequestOptions): Promise<JetResponse<T>> {
    return this.request<T>('GET', url, null, headers, config);
  }

  async gets<T = unknown>(url?: string, headers?: HeadersInit, config?: JetRequestOptions): Promise<JetResponse<T>> {
    return this.request<T>('GET', url, null, headers, { ...config, secure: true });
  }

  async post<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('POST', url, body, headers, config);
  }

  async posts<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('POST', url, body, headers, { ...config, secure: true });
  }

  async put<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('PUT', url, body, headers, config);
  }

  async puts<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('PUT', url, body, headers, { ...config, secure: true });
  }

  async patch<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('PATCH', url, body, headers, config);
  }

  async patchs<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('PATCH', url, body, headers, { ...config, secure: true });
  }

  async delete<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('DELETE', url, body, headers, config);
  }

  async deletes<T = unknown>(
    url?: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
  ): Promise<JetResponse<T>> {
    return this.request<T>('DELETE', url, body, headers, { ...config, secure: true });
  }

  async custom<T = unknown>(
    url: string,
    type: string,
    body?: unknown,
    headers?: HeadersInit,
    config?: JetRequestOptions,
    secure = false,
  ): Promise<JetResponse<T>> {
    return this.request<T>(type, url, body, headers, { ...config, secure: secure || config?.secure });
  }

  async checkPioniaStatusForVersion(versionName = 'v1/'): Promise<JetResponse> {
    if (this.baseUrl && this.baseUrl.includes(versionName)) {
      return this.get('');
    }
    return this.get(versionName);
  }

  async moonlightRequest<T = unknown>(
    data: MoonlightPayload = {},
    targetVersion?: string,
    extraHeaders?: HeadersInit,
    callback?: (res: MoonlightResponse<T>) => unknown,
    config?: JetRequestOptions,
  ): Promise<MoonlightResponse<T> | unknown> {
    return this.executeMoonlight<T>(data, targetVersion, extraHeaders, callback, { ...config, secure: false });
  }

  async secureMoonlightRequest<T = unknown>(
    data: MoonlightPayload = {},
    targetVersion?: string,
    extraHeaders?: HeadersInit,
    callback?: (res: MoonlightResponse<T>) => unknown,
    config?: JetRequestOptions,
  ): Promise<MoonlightResponse<T> | unknown> {
    return this.executeMoonlight<T>(data, targetVersion, extraHeaders, callback, { ...config, secure: true });
  }

  private async executeMoonlight<T>(
    data: MoonlightPayload,
    targetVersion: string | undefined,
    extraHeaders: HeadersInit | undefined,
    callback: ((res: MoonlightResponse<T>) => unknown) | undefined,
    config: JetRequestOptions | undefined,
  ): Promise<MoonlightResponse<T> | unknown> {
    const version = targetVersion ?? this.defaultMoonlightVersion;
    const check = hasServiceAndAction(data);
    if (!check.ok) {
      const message =
        check.missing === 'service'
          ? 'Service was not defined in the request'
          : 'Action was not defined in the request';
      if (this.moonlightErrorHandler) {
        return this.moonlightErrorHandler({ returnMessage: message, returnCode: this.internalErrorCode });
      }
      throw new MoonLightError(message, { returnCode: this.internalErrorCode });
    }

    try {
      const response = await this.request<MoonlightResponse<T>>(
        'POST',
        version,
        data,
        extraHeaders,
        config,
      );
      const payload = response.data;
      const returnCode = payload?.returnCode;
      if (returnCode !== this.moonlightSuccessCode) {
        if (this.moonlightErrorHandler) {
          return this.moonlightErrorHandler(payload);
        }
        throw new MoonLightError(payload?.returnMessage || 'Moonlight request failed', {
          cause: payload,
          returnCode,
          payload,
        });
      }
      if (callback) {
        return callback(payload);
      }
      return payload;
    } catch (error) {
      if (error instanceof MoonLightError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (this.moonlightErrorHandler) {
        return this.moonlightErrorHandler({ returnMessage: message, returnCode: this.internalErrorCode });
      }
      throw new MoonLightError(message, {
        cause: error,
        returnCode: this.internalErrorCode,
      });
    }
  }

  private async request<T>(
    method: string,
    url: string | undefined,
    body: unknown,
    headers?: HeadersInit,
    config: JetRequestOptions = {},
  ): Promise<JetResponse<T>> {
    const {
      timeout,
      retry,
      responseType,
      signal,
      requestKey,
      silent,
      secure,
      params,
      headers: configHeaders,
      ...restInit
    } = config;

    const resolvedUrl = appendParams(joinUrl(this.baseUrl, url), params);
    const requestHeaders = mergeHeaders(this.defaultHeaders, headers, configHeaders);

    if (shouldSetJsonContentType(body, requestHeaders)) {
      requestHeaders.set('Content-Type', 'application/json');
    }

    // Never send Access-Control-Allow-Origin from the client.
    requestHeaders.delete('Access-Control-Allow-Origin');

    if (secure) {
      await this.attachAuthorization(requestHeaders);
    }

    const serialized = serializeBody(body);
    const id = this.state.createId(requestKey);
    const localController = new AbortController();
    if (requestKey) {
      this.controllers.set(id, localController);
    }

    const cacheMode: RequestCache | undefined =
      restInit.cache ??
      (method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD'
        ? this.cachable
          ? 'default'
          : 'no-cache'
        : undefined);

    try {
      return await runPipeline<T>(
        {
          url: resolvedUrl,
          method: method.toUpperCase(),
          body: serialized,
          headers: requestHeaders,
          init: {
            ...restInit,
            cache: cacheMode,
          },
          responseType: responseType ?? this.responseType,
          timeout: timeout ?? this.timeout,
          retry: mergeRetry(this.retry, retry),
          signal: signal ?? localController.signal,
          requestKey: id,
          silent,
        },
        this.state,
      );
    } finally {
      this.controllers.delete(id);
    }
  }

  private async attachAuthorization(headers: Headers): Promise<void> {
    if (headers.has('Authorization')) return;
    // Match 1.x: secure methods still respect interceptWithJWTAuth when explicitly false.
    if (this.interceptWithJWTAuth === false) return;

    const token = await resolveToken({
      getToken: this.getToken,
      token: this.token,
      tokenStorage: this.tokenStorage,
      tokenBearerKey: this.tokenBearerKey,
    });

    if (token) {
      const prefix = this.sendTokenAs ? `${this.sendTokenAs} ` : '';
      headers.set('Authorization', `${prefix}${token}`);
    }
  }

  /** @internal exposed for tests */
  _headersToObject(headers: Headers): Record<string, string> {
    return headersToObject(headers);
  }
}
