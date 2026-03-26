import type { StandardSchemaV1 } from '@standard-schema/spec';

export type StatusHandler<S extends StandardSchemaV1, R> = {
  schema: S;
  transform: (value: StandardSchemaV1.InferOutput<S>) => R;
};

export type ResponseHandlers<R> = {
  [S in number]?: StatusHandler<StandardSchemaV1, R>;
};

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

export class UnrecognizedStatusError extends ApiError {
  constructor(response: Response) {
    super(`Unrecognized status code: ${response.status}`, response);
  }
}

export class MalformedResponseError extends ApiError {
  constructor(
    response: Response,
    public readonly issues: readonly StandardSchemaV1.Issue[]
  ) {
    super(`Malformed response body for status: ${response.status}`, response);
  }
}

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
