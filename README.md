# apifetch

A typed fetch wrapper with [Standard Schema](https://github.com/standard-schema/standard-schema) validation and status-code dispatch.

## Philosophy

HTTP responses fall into two categories:

- **User errors** are expected outcomes — a 404, a 422, a 401. These are part of the API contract and should be handled as returned values, not exceptions. The caller defines a schema and transform for each status code they care about.
- **Computer errors** are unexpected failures — the server returned a status code the client has no handler for, or the response body didn't match the expected schema. These indicate a bug or a contract violation and should throw exceptions.

This means `apiFetch` never throws for non-ok responses. A 422 Unprocessable Content is not an exception — it's a value you handle. Only truly unexpected situations — unrecognized status codes and malformed response bodies — throw.

## Installation

```bash
npm install @viliaapro/apifetch @standard-schema/spec http-status-codes zod
```

## Usage

```typescript
import { apiFetch } from 'apifetch';
import { StatusCodes } from 'http-status-codes';
import { z } from 'zod';

const UserSchema = z.object({ id: z.number(), name: z.string() });
const ErrorSchema = z.object({ message: z.string() });

const result = await apiFetch('/api/users/1', {
  [StatusCodes.OK]: {
    schema: UserSchema,
    transform: (user) => ({ kind: 'ok' as const, user }),
  },
  [StatusCodes.NOT_FOUND]: {
    schema: ErrorSchema,
    transform: (error) => ({ kind: 'not_found' as const, error }),
  },
  [StatusCodes.UNPROCESSABLE_ENTITY]: {
    schema: ErrorSchema,
    transform: (error) => ({ kind: 'invalid' as const, error }),
  },
});

switch (result.kind) {
  case 'ok':        return result.user;
  case 'not_found': return null;
  case 'invalid':   return showErrors(result.error);
}
```

## Schema agnostic

`apiFetch` accepts any [Standard Schema](https://github.com/standard-schema/standard-schema) compliant validator — Zod, Valibot, ArkType, or any other compliant library.

## Errors

Two exceptions are thrown, both extending `ApiError`:

- **`UnrecognizedStatusError`** — the server returned a status code with no registered handler
- **`MalformedResponseError`** — the response body failed schema validation; carries `issues` with the validation details

Both carry the original `Response` object and a `status` convenience getter.

```typescript
import { UnrecognizedStatusError, MalformedResponseError } from 'apifetch';

try {
  const result = await apiFetch('/api/users/1', handlers);
} catch (err) {
  if (err instanceof MalformedResponseError) {
    console.error(err.status, err.issues);
  }
  if (err instanceof UnrecognizedStatusError) {
    console.error(err.status);
  }
}
```

## API

### `apiFetch<R>(url, handlers, options?)`

| Parameter  | Type                  | Description                        |
|------------|-----------------------|------------------------------------|
| `url`      | `string`              | Request URL                        |
| `handlers` | `ResponseHandlers<R>` | Map of status codes to handlers    |
| `options`  | `RequestInit`         | Standard fetch options (optional)  |

Returns `Promise<R>` where `R` is inferred from the transform return types.

## License

MIT
