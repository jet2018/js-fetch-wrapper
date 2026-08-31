# jet-fetch 2.x

TypeScript-first fetch wrapper with native **Moonlight** support, portable auth (browsers, React Native, Node 18+), retries, timeouts, and request-state tracking.

## Install

```bash
npm i jet-fetch
# or
yarn add jet-fetch
```

Requires a runtime with `globalThis.fetch` (modern browsers, Node 18+, React Native).

## Quick start

```ts
import { Jet, MemoryStorage } from 'jet-fetch';

const jet = new Jet({
  baseUrl: 'https://api.example.com/api/',
  getToken: async () => 'your-jwt', // portable — no localStorage required
  timeout: 15_000,
  retry: { retries: 3, backoff: 'exponential' },
});

const { data, status } = await jet.get<{ users: string[] }>('users');
```

## Configuration

| Option | Default | Notes |
|--------|---------|--------|
| `baseUrl` | `null` | Prefixed to relative URLs |
| `getToken` | — | Preferred async/sync token provider |
| `token` | — | Static token or getter (1.x compat) |
| `tokenStorage` | `localStorage` when available | Inject `MemoryStorage` / AsyncStorage adapter |
| `tokenBearerKey` | `'SecretKey'` | Storage key |
| `sendTokenAs` | `'Bearer'` | Authorization scheme prefix |
| `interceptWithJWTAuth` | auto | Gate for secure auth attachment |
| `defaultHeaders` | `{}` | Merged per request (no shared mutation) |
| `cachable` | `true` | Sets Request `cache` for GET/HEAD |
| `timeout` | `0` | Milliseconds; `0` disables |
| `retry` | `{ retries: 0 }` | See Retrying |
| `responseType` | `'json'` | `json` \| `text` \| `blob` \| `arrayBuffer` \| `auto` |
| `moonlightSuccessCode` | `0` | Business success code |
| `moonlightErrorHandler` | — | Custom Moonlight error callback |
| `defaultMoonlightVersion` | `'v1/'` | Default Moonlight path |
| `onStateChange` | — | Global request-state listener |

## HTTP methods

```ts
await jet.get(url, headers?, config?);
await jet.post(url, body?, headers?, config?);
await jet.put(url, body?, headers?, config?);
await jet.patch(url, body?, headers?, config?);
await jet.delete(url, body?, headers?, config?);
await jet.custom(url, method, body?, headers?, config?, secure?);
```

Secure counterparts attach Authorization: `gets`, `posts`, `puts`, `patchs`, `deletes`.

Each call returns:

```ts
{ response: Response; data: T; status: number; ok: boolean; headers: Headers }
```

### Request options

```ts
await jet.get('items', undefined, {
  params: { page: 1 },
  timeout: 5_000,
  retry: { retries: 2 },
  responseType: 'json',
  requestKey: 'items-list', // for state tracking / abort
  signal: controller.signal,
});
```

### Bodies

JSON objects are stringified. `FormData`, `Blob`, `URLSearchParams`, and other `BodyInit` values are passed through (and JSON `Content-Type` is not forced for multipart).

## Retrying

```ts
const jet = new Jet({
  retry: {
    retries: 3,
    retryDelay: 300,
    backoff: 'exponential', // 'none' | 'fixed' | 'exponential'
    maxDelay: 10_000,
    retryOnStatuses: [408, 429, 500, 502, 503, 504],
    retryUnsafeMethods: false, // keep false to avoid double POST
    onRetry: (attempt, error) => console.debug('retry', attempt, error),
  },
});
```

Network failures and selected HTTP statuses retry for idempotent methods (`GET`, `HEAD`, `OPTIONS`, `PUT`, `DELETE`) unless `retryUnsafeMethods: true`.

## Request state

```ts
const jet = new Jet({
  onStateChange: (snap) => {
    // snap.status: idle | loading | success | error | aborted
    console.log(snap.loading, snap.data, snap.error);
  },
});

jet.on('request:start', (s) => {});
jet.on('request:success', (s) => {});
jet.on('request:error', (s) => {});

await jet.get('x', undefined, { requestKey: 'home' });
jet.abort('home');
jet.isLoading; // any in-flight tracked request
```

### React hooks (optional)

```ts
import { useJetRequest, useMoonlight } from 'jet-fetch/react';

const { data, loading, error, refetch } = useJetRequest(jet, 'users');
const { execute, loading: mlLoading } = useMoonlight(jet, { secure: true });
await execute({ service: 'auth', action: 'profile' });
```

Peer dependency: `react` >= 17.

## Moonlight / Pionia

```ts
import { Jet, MoonLightError } from 'jet-fetch';

const jet = new Jet({ baseUrl: 'http://localhost:8000/api/' });

await jet.checkPioniaStatusForVersion('v1/');

try {
  const res = await jet.moonlightRequest({
    service: 'auth',
    action: 'login',
    email: 'a@b.com',
    password: 'secret',
  }, 'v1/');
  // res.returnCode === 0, res.returnData, res.returnMessage
} catch (e) {
  if (e instanceof MoonLightError) {
    console.error(e.message, e.payload);
  }
}

await jet.secureMoonlightRequest({ SERVICE: 'user', ACTION: 'me' }, 'v2/');
```

`service`/`action` and `SERVICE`/`ACTION` are both accepted.

## Mobile & cross-runtime auth

```ts
import { Jet, MemoryStorage, createAsyncStorageAdapter } from 'jet-fetch';

// Node / tests / SSR
new Jet({ tokenStorage: new MemoryStorage() });

// React Native AsyncStorage
new Jet({
  tokenStorage: createAsyncStorageAdapter(AsyncStorage),
  tokenBearerKey: 'authToken',
});

// Fully custom
new Jet({
  getToken: () => secureStore.get(),
});
```

## Migration from 1.x

- Import `{ Jet }` (default export still works).
- Constructor now takes an **options object** (not positional args).
- Dropped `node-fetch` — use Node 18+ or any fetch polyfill.
- Response shape adds `status`, `ok`, `headers` (still includes `response` + `data`).
- Do not set `Access-Control-Allow-Origin` from the client (ignored/removed).

## Scripts

```bash
npm test
npm run build
npm run typecheck
```

## License

ISC
