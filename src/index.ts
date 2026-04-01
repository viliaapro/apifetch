import type { StandardSchemaV1 } from '@standard-schema/spec';

// A single handler for one status code: a schema to validate the body
// and a transform function to convert the validated value to R
export type ResponseHandler<S extends StandardSchemaV1, R> = {
  schema: S;
  transform: (value: StandardSchemaV1.InferOutput<S>) => R;
};

// A map of status codes to handlers — the keys you register determine
// which status codes are expected; anything else throws UnrecognizedStatusError
export type ResponseHandlers<R> = {
  [S in number]?: ResponseHandler<StandardSchemaV1, R>;
};

// Base class for all errors thrown by this library — always carries
// the original Response for inspection by the caller
export class ApiError extends Error {
  get status() { return this.response.status; }

  constructor(
    message: string,
    public readonly response: Response,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

// The server returned a status code with no registered handler —
// this is a computer error: the client and server are out of sync
export class UnrecognizedStatusError extends ApiError {
  constructor(response: Response) {
    super(`Unrecognized status code: ${response.status}`, response);
  }
}

// The server returned a recognized status but the body failed schema
// validation — the contract has been violated
export class MalformedResponseError extends ApiError {
  constructor(
    response: Response,
    public readonly issues: readonly StandardSchemaV1.Issue[]
  ) {
    super(`Malformed response body for status: ${response.status}`, response);
  }
}

// Workhorse: validates and dispatches a Response you already have
export async function handleResponse<R>(
  response: Response,
  handlers: ResponseHandlers<R>
): Promise<R> {
  const handler = handlers[response.status];

  if (!handler) {
    throw new UnrecognizedStatusError(response);
  }

  const body = await response.json();
  const result = await handler.schema['~standard'].validate(body);

  if (result.issues) {
    throw new MalformedResponseError(response, result.issues);
  }

  return handler.transform(result.value);
}

// Convenience wrapper: performs the fetch then delegates to handleResponse
export async function apiFetch<R>(
  url: string,
  handlers: ResponseHandlers<R>,
  options: RequestInit = {}
): Promise<R> {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });

  return handleResponse(response, handlers);
}
