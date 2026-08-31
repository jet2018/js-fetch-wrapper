# jet-fetch

**TypeScript-first fetch client** for browsers, React Native, and Node 18+.

Built for everyday REST work and first-class [Moonlight](https://pionia.netlify.app/moonlight/introduction-to-moonlight-architecture/) / [Pionia](https://pionia.netlify.app) backends — with retries, timeouts, portable JWT auth, and request-state tracking.

```ts
import { Jet } from 'jet-fetch';

const jet = new Jet({
  baseUrl: 'https://api.example.com/api/',
  getToken: () => localStorage.getItem('token'),
  timeout: 15_000,
  retry: { retries: 3, backoff: 'exponential' },
});

const { data, status } = await jet.get<{ id: number }>('users/1');
```

---

## Table of contents

- [Why jet-fetch](#why-jet-fetch)
- [Install](#install)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Creating a client](#creating-a-client)
- [Making requests](#making-requests)
- [Authentication](#authentication)
- [Retrying (idempotent by default)](#retrying-idempotent-by-default)
- [Timeouts and abort](#timeouts-and-abort)
- [Request state (framework-agnostic)](#request-state-framework-agnostic)
- [Moonlight / Pionia](#moonlight--pionia)
- [Errors](#errors)
- [API reference](#api-reference)
- [Migration from 1.x](#migration-from-1x)
- [Contributing](#contributing)
- [License](#license)

---

## Why jet-fetch

| Feature | Support |
|---------|---------|
| TypeScript-only, typed responses | Yes |
| Browsers + Node 18+ + React Native | Yes (`globalThis.fetch`) |
| GET / POST / PUT / PATCH / DELETE + `custom` | Yes |
| Secure (`*s`) methods with JWT | Yes |
| Portable token providers (no hard `localStorage`) | Yes |
| FormData / Blob / multipart uploads | Yes |
| Idempotent retries + `Idempotency-Key` | Yes |
| Timeouts + `AbortController` | Yes |
| Request lifecycle state (`loading`, etc.) | Yes |
| Framework-agnostic resources (Vue / Angular / …) | Yes (`createJetResource`) |
| Optional React hooks | Yes (`jet-fetch/react`) |
| Moonlight POST + GET + unified helper | Yes (Pionia v3) |

---

## Install

```bash
npm install jet-fetch
```

```bash
yarn add jet-fetch
```

```bash
pnpm add jet-fetch
```

---

## Requirements

- A runtime with **`globalThis.fetch`**
  - Modern evergreen browsers
  - Node.js **18+**
  - React Native (0.65+ / Hermes with fetch)
- TypeScript **4.7+** recommended (types ship in the package)
- React **17+** only if you import `jet-fetch/react` (optional). Vue/Angular/Svelte use `createJetResource`.

---

## Quick start

```ts
import { Jet } from 'jet-fetch';

const jet = new Jet({
  baseUrl: 'https://api.example.com/api/',
});

// Relative to baseUrl
const users = await jet.get('users');
console.log(users.data, users.status);

// Absolute URL still works
await jet.get('https://other.example.com/health');

// JSON body
await jet.post('users', { name: 'Ada' });

 // Multipart upload
const form = new FormData();
form.append('file', file);
await jet.post('uploads', form);
```

Named export is preferred:

```ts
import { Jet } from 'jet-fetch';
```

A default export is kept for compatibility: `import Jet from 'jet-fetch'`.

---

## Creating a client

Pass a single **options object** to the constructor.

```ts
import { Jet, MemoryStorage } from 'jet-fetch';

const jet = new Jet({
  baseUrl: 'https://api.example.com/api/',
  getToken: async () => secureStore.getToken(),
  sendTokenAs: 'Bearer',
  defaultHeaders: {
    Accept: 'application/json',
    'X-App-Version': '2.0.0',
  },
  timeout: 15_000,
  retry: { retries: 3, backoff: 'exponential' },
  responseType: 'json',
  cachable: true,
  moonlightSuccessCode: 0,
  defaultMoonlightVersion: 'v1/',
  onStateChange: (state) => {
    // state.loading, state.status, state.data, state.error
  },
});
```

### Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | `string \| null` | `null` | Prefixed onto relative request URLs |
| `getToken` | `() => string \| null \| Promise<…>` | — | Preferred token provider (sync or async) |
| `token` | `string \| TokenGetter \| null` | `null` | Static token or getter (1.x compatible) |
| `tokenStorage` | `TokenStorage` | `localStorage` when available | Key-value store used when `getToken` / `token` are unset |
| `tokenBearerKey` | `string` | `'SecretKey'` | Key read from `tokenStorage` |
| `sendTokenAs` | `string` | `'Bearer'` | Authorization scheme prefix (`Bearer`, `JWT`, `Token`, or `''`) |
| `interceptWithJWTAuth` | `boolean` | auto | When `false`, secure methods will not attach auth |
| `defaultHeaders` | `HeadersInit` | `{}` | Headers merged into every request (copied per call) |
| `cachable` | `boolean` | `true` | Sets Request `cache` for GET/HEAD (`default` vs `no-cache`) |
| `timeout` | `number` | `0` | Default timeout in ms (`0` = none) |
| `retry` | `RetryPolicy` | `{ retries: 0 }` | Default retry policy |
| `responseType` | `ResponseType` | `'json'` | How to parse response bodies |
| `moonlightSuccessCode` | `number` | `0` | Moonlight business success code |
| `moonlightErrorHandler` | `function` | — | Custom Moonlight error handler (suppresses throw) |
| `internalErrorCode` | `number` | `success + 1000` | Code used for transport / client-side Moonlight errors |
| `defaultMoonlightVersion` | `string` | `'v1/'` | Default Moonlight version path |
| `onStateChange` | `(snapshot) => void` | — | Global request-state listener |

---

## Making requests

### Standard methods

```ts
await jet.get(url?, headers?, config?);
await jet.post(url?, body?, headers?, config?);
await jet.put(url?, body?, headers?, config?);
await jet.patch(url?, body?, headers?, config?);
await jet.delete(url?, body?, headers?, config?);
await jet.custom(url, method, body?, headers?, config?, secure?);
```

### Secure methods (attach Authorization)

```ts
await jet.gets(url?, headers?, config?);
await jet.posts(url?, body?, headers?, config?);
await jet.puts(url?, body?, headers?, config?);
await jet.patchs(url?, body?, headers?, config?);
await jet.deletes(url?, body?, headers?, config?);
await jet.custom(url, method, body, headers, config, true);
```

### Response shape

Every HTTP method resolves to:

```ts
interface JetResponse<T = unknown> {
  response: Response; // native Fetch Response
  data: T;            // parsed body
  status: number;
  ok: boolean;
  headers: Headers;
}
```

Example:

```ts
const res = await jet.get<{ name: string }>('profile');
if (res.ok) {
  console.log(res.data.name);
  console.log(res.status); // 200
}
```

### Per-request options

```ts
await jet.get('items', undefined, {
  params: { page: 1, q: 'jet' },   // query string
  headers: { 'X-Trace': '1' },
  timeout: 5_000,                  // override client timeout
  retry: { retries: 2 },           // override retry policy
  responseType: 'json',            // json | text | blob | arrayBuffer | auto
  requestKey: 'items-list',        // for state tracking / abort
  signal: controller.signal,       // external AbortSignal
  cache: 'no-store',               // any valid RequestInit field
});
```

Pass `retry: false` to disable retries for one call.

### Request bodies

| Body type | Behavior |
|-----------|----------|
| Plain object / array | `JSON.stringify` + `Content-Type: application/json` |
| `FormData` | Sent as-is (browser sets multipart boundary) |
| `Blob` / `File` / `URLSearchParams` / `ArrayBuffer` / typed arrays | Sent as-is |
| `string` | Sent as-is |

```ts
// JSON
await jet.post('users', { email: 'a@b.com' });

// Multipart
const form = new FormData();
form.append('avatar', file);
await jet.posts('me/avatar', form);
```

### Custom methods

```ts
await jet.custom('resource', 'HEAD');
await jet.custom('resource', 'OPTIONS', null, {}, {}, false);
```

---

## Authentication

jet-fetch never requires `localStorage`. Prefer an explicit token source.

### 1. `getToken` (recommended)

```ts
const jet = new Jet({
  baseUrl: 'https://api.example.com',
  getToken: async () => await SecureStore.getItemAsync('token'),
});

await jet.gets('/me'); // Authorization: Bearer <token>
```

### 2. Static `token`

```ts
const jet = new Jet({
  baseUrl: 'https://api.example.com',
  token: sessionStorage.getItem('token'),
  sendTokenAs: 'JWT',
});
```

### 3. Storage adapters

```ts
import {
  Jet,
  MemoryStorage,
  createLocalStorageAdapter,
  createSessionStorageAdapter,
  createAsyncStorageAdapter,
} from 'jet-fetch';

// Node / tests / SSR
new Jet({ tokenStorage: new MemoryStorage(), tokenBearerKey: 'auth' });

// Browser
new Jet({ tokenStorage: createLocalStorageAdapter()! });
new Jet({ tokenStorage: createSessionStorageAdapter()! });

// React Native
import AsyncStorage from '@react-native-async-storage/async-storage';

new Jet({
  tokenStorage: createAsyncStorageAdapter(AsyncStorage),
  tokenBearerKey: 'authToken',
  sendTokenAs: 'Bearer',
});
```

### How secure requests decide the token

Resolution order:

1. `getToken()`
2. `token` (string or function)
3. `tokenStorage.getItem(tokenBearerKey)`

Header format:

```http
Authorization: <sendTokenAs> <token>
```

If `sendTokenAs` is `''`, only the raw token is sent.

Set `interceptWithJWTAuth: false` to prevent secure methods from attaching auth.

---
## Retrying (idempotent by default)

Retries are **off by default**. When enabled, jet-fetch only retries **idempotent** methods unless you opt in otherwise.

```ts
const jet = new Jet({
  retry: {
    retries: 3,                 // attempts after the first try
    retryDelay: 300,            // base delay (ms)
    backoff: 'exponential',     // 'none' | 'fixed' | 'exponential'
    maxDelay: 10_000,
    retryOnStatuses: [408, 429, 500, 502, 503, 504],
    idempotentOnly: true,       // default — GET/HEAD/OPTIONS/PUT/DELETE only
    onRetry: (attempt, error) => {
      console.debug('retrying', attempt, error);
    },
  },
});
```

### Idempotency rules

| Situation | Retries? |
|-----------|----------|
| `GET` / `HEAD` / `OPTIONS` / `PUT` / `DELETE` | Yes (when `retries > 0`) |
| `POST` / `PATCH` with no key | **No** (default) |
| `POST` / `PATCH` with `idempotencyKey` | **Yes** — sends `Idempotency-Key` header |
| `idempotentOnly: false` or `retryUnsafeMethods: true` | Allows unsafe method retries |

```ts
// Safe POST retries with an idempotency key
await jet.post('orders', payload, undefined, {
  idempotencyKey: crypto.randomUUID(),
  retry: { retries: 2, backoff: 'exponential' },
});
```

What gets retried: network failures, timeouts, and statuses in `retryOnStatuses`.

Moonlight **business** failures (`returnCode !== success`) are never retried — only transport-level failures.

Pass `retry: false` on a single call to disable retries for that request.

---

## Timeouts and abort

### Client or per-request timeout

```ts
const jet = new Jet({ timeout: 10_000 });

await jet.get('slow', undefined, { timeout: 2_000 });
```

Timeouts reject with `TimeoutError`.

### AbortController

```ts
const controller = new AbortController();

const pending = jet.get('search', undefined, {
  signal: controller.signal,
  requestKey: 'search',
});

controller.abort();
// or
jet.abort('search');
jet.abortAll();
```

Aborted requests reject with an abort error and mark state as `aborted`.

---

## Request state (framework-agnostic)

Core jet-fetch has **no React / Vue / Angular dependency**. Track loading with events or `createJetResource`.

```ts
const jet = new Jet({
  onStateChange: (snap) => {
    console.log(snap.id, snap.status, snap.loading);
  },
});

jet.on('request:start', (s) => {});
jet.on('request:retry', (s) => {});
jet.on('request:success', (s) => {});
jet.on('request:error', (s) => {});
jet.on('request:aborted', (s) => {});
jet.on('request:change', (s) => {});

await jet.get('dashboard', undefined, { requestKey: 'dashboard' });
jet.isLoading;
jet.getRequestState('dashboard');
```

### `createJetResource` — Vue, Angular, Svelte, plain JS

```ts
import { createJetGetResource, createMoonlightResource } from 'jet-fetch';

const users = createJetGetResource(jet, 'users', { key: 'users' });

const stop = users.subscribe((snap) => {
  // snap.loading, snap.data, snap.error, snap.status
});

await users.execute();
users.abort();
stop();
users.destroy();
```

**Vue 3**

```ts
import { ref, onMounted, onUnmounted } from 'vue';
import { createJetGetResource } from 'jet-fetch';

const resource = createJetGetResource(jet, 'users', { key: 'users' });
const state = ref(resource.getSnapshot());
const stop = resource.subscribe((s) => { state.value = s; });

onMounted(() => resource.execute());
onUnmounted(() => { stop(); resource.destroy(); });
```

**Angular**

```ts
import { createMoonlightResource } from 'jet-fetch';

const resource = createMoonlightResource(this.jet, {
  service: 'product',
  action: 'list',
}, { method: 'POST', key: 'products' });

resource.subscribe((s) => {
  this.zone.run(() => {
    this.loading = s.loading;
    this.data = s.data;
    this.error = s.error;
  });
});

await resource.execute();
```

### Optional React hooks

React is an **optional peer dependency** — only needed if you import `jet-fetch/react`.

```ts
import { useJetRequest, useMoonlight } from 'jet-fetch/react';

const { data, loading, error, refetch, abort } = useJetRequest(jet, 'users');
const { execute, loading: mlLoading } = useMoonlight(jet, { secure: true, version: 'v1/' });
await execute({ service: 'auth', action: 'profile' });
```

---

## Moonlight / Pionia

Aligned with [Pionia Requests & Responses](https://pionia.netlify.app/documentation/http/requests-and-responses/):

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/ping` | Health check |
| `POST` | `/api/v1/` | Primary dispatch `{ service, action, ...params }` |
| `GET` | `/api/v1/{service}/{action}/` | Optional query-string dispatch |

Pionia v3 expects **lowercase** `service` / `action`. jet-fetch normalizes uppercase keys on POST. Check **both** HTTP status (422/401/404) and `returnCode`.

### Health check

```ts
await jet.checkPioniaStatusForVersion('v1/'); // GET …/v1/ping
```

### Moonlight POST (primary)

```ts
import { Jet, MoonLightError } from 'jet-fetch';

const jet = new Jet({ baseUrl: 'http://localhost:8000/api/' });

try {
  const res = await jet.moonlightPost({
    service: 'auth',
    action: 'login',
    email: 'ada@example.com',
    password: 'secret',
  }, 'v1/');

  console.log(res.returnData);
} catch (error) {
  if (error instanceof MoonLightError) {
    console.error(error.message, error.returnCode, error.payload);
  }
}

await jet.secureMoonlightPost({ service: 'user', action: 'profile' }, 'v1/');
```

### Moonlight GET (optional path dispatch)

```ts
// GET /api/v1/product/list/?status=open
await jet.moonlightGet({
  service: 'product',
  action: 'list',
  status: 'open',
}, 'v1/');

await jet.secureMoonlightGet({ service: 'user', action: 'me' }, 'v1/');
```

GET Moonlight calls are **idempotent** and participate in the default retry policy.

### Both — unified helper

`moonlightRequest` / `secureMoonlightRequest` support **both** verbs (default POST):

```ts
// POST (default) — same as moonlightPost
await jet.moonlightRequest({ service: 'product', action: 'list' }, 'v1/');

// GET via options object
await jet.moonlightRequest(
  { service: 'product', action: 'list', status: 'open' },
  { method: 'GET', version: 'v1/' },
);

await jet.secureMoonlightRequest(
  { service: 'user', action: 'me' },
  { method: 'GET', version: 'v1/' },
);
```

### Callback style

```ts
await jet.moonlightPost(
  { service: 'catalog', action: 'list' },
  'v1/',
  { 'X-Locale': 'en' },
  (res) => setItems(res.returnData),
);
```

### Custom success code and error handler

```ts
const jet = new Jet({
  baseUrl: 'http://localhost:8000/api/',
  moonlightSuccessCode: 0,
  moonlightErrorHandler: (error) => {
    toast.error(error.returnMessage ?? 'Request failed');
    return error;
  },
});
```

When `moonlightErrorHandler` is set, Moonlight helpers **return** its result instead of throwing.

### Safe Moonlight POST retries

```ts
await jet.moonlightPost(
  { service: 'order', action: 'create' },
  'v1/',
  undefined,
  undefined,
  {
    idempotencyKey: crypto.randomUUID(),
    retry: { retries: 2 },
  },
);
```

---

## Errors

| Class | When |
|-------|------|
| `JetError` | Base error |
| `HttpError` | Non-OK HTTP used in retry signaling |
| `TimeoutError` | Request exceeded `timeout` |
| `AbortRequestError` | Request aborted |
| `MoonLightError` | Moonlight business / HTTP / client failure |

```ts
import { MoonLightError, TimeoutError, isAbortError } from 'jet-fetch';

try {
  await jet.get('slow', undefined, { timeout: 1000 });
} catch (error) {
  if (error instanceof TimeoutError) { /* … */ }
  else if (isAbortError(error)) { /* … */ }
  else if (error instanceof MoonLightError) { /* … */ }
}
```

---

## API reference

### Exports (`jet-fetch`)

| Export | Kind |
|--------|------|
| `Jet` | Client class |
| `MemoryStorage` / storage adapters | Portable auth storage |
| `createJetResource` | Framework-agnostic reactive resource |
| `createJetGetResource` | GET resource helper |
| `createMoonlightResource` | Moonlight GET/POST resource helper |
| `MoonLightError`, `TimeoutError`, … | Errors |

### Exports (`jet-fetch/react`) — optional

| Export | Kind |
|--------|------|
| `useJetRequest` / `useMoonlight` | React hooks |

Requires peer `react` >= 17. Vue/Angular/Svelte should use `createJetResource` instead.

### `Jet` Moonlight members

| Member | Description |
|--------|-------------|
| `moonlightPost` / `secureMoonlightPost` | POST `{version}` with `{ service, action, … }` |
| `moonlightGet` / `secureMoonlightGet` | GET `{version}{service}/{action}/` |
| `moonlightRequest` / `secureMoonlightRequest` | Both — default POST; `{ method: 'GET' }` for path dispatch |
| `checkPioniaStatusForVersion` | `GET {version}ping` |

---

## Migration from 1.x

| 1.x | 2.x |
|-----|-----|
| Positional constructor | `new Jet({ baseUrl, … })` |
| `node-fetch` | `globalThis.fetch` (Node 18+) |
| Moonlight POST only | `moonlightPost`, `moonlightGet`, and unified `moonlightRequest` |
| `{ response, data }` | `{ response, data, status, ok, headers }` |

---

## Package scripts

```bash
npm test
npm run build
npm run typecheck
```

---

## Contributing

Fork, branch, test with `npm test` / `npm run build`, then open a PR.

Issues: [github.com/jet2018/js-fetch-wrapper/issues](https://github.com/jet2018/js-fetch-wrapper/issues)

---

## License

[ISC](LICENSE)
