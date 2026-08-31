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
- [Retrying](#retrying)
- [Timeouts and abort](#timeouts-and-abort)
- [Request state](#request-state)
- [Moonlight / Pionia](#moonlight--pionia)
- [React hooks](#react-hooks)
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
| Retries with exponential backoff | Yes |
| Timeouts + `AbortController` | Yes |
| Request lifecycle state (`loading`, etc.) | Yes |
| Native Moonlight helpers | Yes |
| Optional React hooks | Yes (`jet-fetch/react`) |

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
- React **17+** only if you use `jet-fetch/react`

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

## Retrying

Retries are **off by default**. Enable them on the client or per request.

```ts
const jet = new Jet({
  retry: {
    retries: 3,                 // attempts after the first try
    retryDelay: 300,            // base delay (ms)
    backoff: 'exponential',     // 'none' | 'fixed' | 'exponential'
    maxDelay: 10_000,
    retryOnStatuses: [408, 429, 500, 502, 503, 504],
    retryUnsafeMethods: false,  // keep false to avoid double POST
    onRetry: (attempt, error) => {
      console.debug('retrying', attempt, error);
    },
  },
});
```

### What gets retried?

- Network / transport failures
- HTTP statuses listed in `retryOnStatuses`
- Timeouts

By default only **idempotent** methods retry: `GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`.

Set `retryUnsafeMethods: true` to allow `POST` / `PATCH` retries (use carefully).

Moonlight business failures (`returnCode !== success`) are **not** retried; only transport-level failures can be.

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

## Request state

Track loading UI without coupling to a framework.

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
jet.on('request:change', (s) => {}); // fires for every transition

await jet.get('dashboard', undefined, { requestKey: 'dashboard' });

jet.isLoading;
jet.getRequestState('dashboard');
```

### Snapshot shape

```ts
interface RequestStateSnapshot<T = unknown> {
  id: string;
  status: 'idle' | 'loading' | 'success' | 'error' | 'aborted';
  loading: boolean;
  data: T | null;
  error: unknown | null;
  attempt: number;
  url?: string;
  method?: string;
  startedAt?: number;
  finishedAt?: number;
}
```

Use a stable `requestKey` when you need to read or abort a specific call.

---

## Moonlight / Pionia

[Moonlight](https://pionia.netlify.app/moonlight/introduction-to-moonlight-architecture/) APIs use one versioned endpoint and a `service` + `action` body. All HTTP responses are typically `200`; business success is `returnCode === 0` (configurable).

### Assumptions

1. Requests are `POST` to a version path such as `v1/`
2. Body includes `service` / `action` (or `SERVICE` / `ACTION`)
3. Response includes `returnCode`, `returnMessage`, and usually `returnData` / `extraData`
4. HTTP status is `200` even when the business call fails

### Unauthenticated request

```ts
import { Jet, MoonLightError } from 'jet-fetch';

const jet = new Jet({
  baseUrl: 'http://localhost:8000/api/',
});

try {
  const res = await jet.moonlightRequest({
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
```

### Authenticated request

```ts
await jet.secureMoonlightRequest(
  { SERVICE: 'user', ACTION: 'profile' },
  'v2/',
);
```

### Callback / subscription style

```ts
await jet.moonlightRequest(
  { service: 'catalog', action: 'list' },
  'v1/',
  { 'X-Locale': 'en' },
  (res) => {
    // called with successful Moonlight payload
    setItems(res.returnData);
  },
);
```

### Custom success code and error handler

```ts
const jet = new Jet({
  baseUrl: 'http://localhost:8000/api/',
  moonlightSuccessCode: 200,
  moonlightErrorHandler: (error) => {
    toast.error(error.returnMessage ?? 'Request failed');
    return error;
  },
});
```

When `moonlightErrorHandler` is set, Moonlight helpers **return** its result instead of throwing.

### API availability check

```ts
await jet.checkPioniaStatusForVersion('v1/');
```

### Typed Moonlight payload

```ts
type Profile = { id: number; name: string };

const res = await jet.secureMoonlightRequest<Profile>({
  service: 'user',
  action: 'me',
});

// res is MoonlightResponse<Profile> on success
```

---

## React hooks

Optional peer dependency: `react >= 17`.

```ts
import { useJetRequest, useMoonlight } from 'jet-fetch/react';
import { jet } from './api'; // your shared Jet instance

function UsersPage() {
  const { data, loading, error, refetch, abort } = useJetRequest(jet, 'users', {
    requestKey: 'users-page',
  });

  if (loading) return <p>Loading…</p>;
  if (error) return <p>Failed</p>;

  return (
    <>
      <button onClick={() => refetch()}>Refresh</button>
      <button onClick={() => abort()}>Cancel</button>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </>
  );
}

function LoginForm() {
  const { execute, loading, error } = useMoonlight(jet, {
    requestKey: 'login',
    secure: false,
    version: 'v1/',
  });

  return (
    <button
      disabled={loading}
      onClick={() =>
        execute({ service: 'auth', action: 'login', email, password })
      }
    >
      Sign in
    </button>
  );
}
```

---

## Errors

| Class | When |
|-------|------|
| `JetError` | Base error |
| `HttpError` | Non-OK HTTP used in retry signaling (`status`, `response`, `data`) |
| `TimeoutError` | Request exceeded `timeout` |
| `AbortRequestError` | Request aborted |
| `MoonLightError` | Moonlight business or client failure (`returnCode`, `payload`) |

```ts
import { MoonLightError, TimeoutError, isAbortError } from 'jet-fetch';

try {
  await jet.get('slow', undefined, { timeout: 1000 });
} catch (error) {
  if (error instanceof TimeoutError) {
    // …
  } else if (isAbortError(error)) {
    // …
  } else if (error instanceof MoonLightError) {
    // …
  }
}
```

---

## API reference

### Exports (`jet-fetch`)

| Export | Kind |
|--------|------|
| `Jet` | Client class |
| `default` | Alias of `Jet` |
| `MemoryStorage` | In-memory `TokenStorage` |
| `createLocalStorageAdapter` | Browser localStorage adapter |
| `createSessionStorageAdapter` | Browser sessionStorage adapter |
| `createAsyncStorageAdapter` | Wrap AsyncStorage-like APIs |
| `resolveToken` | Low-level token resolver |
| `RequestStateTracker` | Standalone state tracker |
| `JetError`, `HttpError`, `TimeoutError`, `AbortRequestError`, `MoonLightError` | Errors |
| `isAbortError` | Abort detector |
| Types | `Configuration`, `RetryPolicy`, `JetRequestOptions`, `JetResponse`, `MoonlightPayload`, `MoonlightResponse`, `RequestStateSnapshot`, … |

### Exports (`jet-fetch/react`)

| Export | Kind |
|--------|------|
| `useJetRequest` | Hook for GET (or secure GET) with loading state |
| `useMoonlight` | Hook helper for Moonlight execute + loading state |

### `Jet` instance members

| Member | Description |
|--------|-------------|
| `get` / `gets` | GET |
| `post` / `posts` | POST |
| `put` / `puts` | PUT |
| `patch` / `patchs` | PATCH |
| `delete` / `deletes` | DELETE |
| `custom` | Arbitrary method |
| `moonlightRequest` | Moonlight POST helper |
| `secureMoonlightRequest` | Moonlight POST with auth |
| `checkPioniaStatusForVersion` | Version availability GET |
| `on` / `onStateChange` | Event subscriptions |
| `getRequestState` | Read snapshot by id |
| `isLoading` | Any tracked request in flight |
| `abort` / `abortAll` | Cancel tracked requests |

---

## Migration from 1.x

| 1.x | 2.x |
|-----|-----|
| `new Jet(baseUrl, intercept, token, …)` | `new Jet({ baseUrl, … })` |
| `import Jet from 'jet-fetch'` | Prefer `import { Jet } from 'jet-fetch'` |
| Depends on `node-fetch` | Uses `globalThis.fetch` (Node 18+) |
| Always `response.json()` | Configurable `responseType`; empty body → `null` |
| Shared mutable headers | Headers copied per request |
| `localStorage` required for JWT | `getToken` / adapters / MemoryStorage |
| `{ response, data }` | `{ response, data, status, ok, headers }` |
| Client `Access-Control-Allow-Origin` | Removed (invalid on the client) |

Minimal upgrade:

```ts
// before
const jet = new Jet('https://api.example.com', true, null, 'SecretKey', 'Bearer');

// after
const jet = new Jet({
  baseUrl: 'https://api.example.com',
  interceptWithJWTAuth: true,
  tokenBearerKey: 'SecretKey',
  sendTokenAs: 'Bearer',
});
```

---

## Package scripts

```bash
npm test          # vitest
npm run build     # ESM + CJS + typings
npm run typecheck
```

---

## Contributing

1. Fork and create a branch
2. Make your changes with tests
3. Run `npm test` and `npm run build`
4. Open a pull request

Issues: [github.com/jet2018/js-fetch-wrapper/issues](https://github.com/jet2018/js-fetch-wrapper/issues)

---

## License

[ISC](LICENSE)
