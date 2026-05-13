export interface RetryOpts {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export const DEFAULT_RETRY_OPTS: Required<RetryOpts> = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  };

  const status =
    candidate.status ?? candidate.statusCode ?? candidate.response?.status;

  return typeof status === 'number' ? status : undefined;
}

function getHeaderValue(headers: unknown, headerName: string): string | null {
  if (!headers || typeof headers !== 'object') {
    return null;
  }

  if ('get' in headers && typeof headers.get === 'function') {
    const value = headers.get(headerName);
    return typeof value === 'string' ? value : null;
  }

  const normalizedHeader = headerName.toLowerCase();
  const entries = Object.entries(headers as Record<string, unknown>);

  for (const [key, value] of entries) {
    if (key.toLowerCase() !== normalizedHeader) {
      continue;
    }

    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      const firstValue = value.find((entry) => typeof entry === 'string');
      return typeof firstValue === 'string' ? firstValue : null;
    }
  }

  return null;
}

function getRetryAfterMs(error: unknown, maxDelayMs: number): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as {
    headers?: unknown;
    response?: { headers?: unknown };
  };
  const retryAfterValue =
    getHeaderValue(candidate.headers, 'retry-after') ??
    getHeaderValue(candidate.response?.headers, 'retry-after');

  if (!retryAfterValue) {
    return undefined;
  }

  const retryAfterSeconds = Number(retryAfterValue);
  if (Number.isFinite(retryAfterSeconds)) {
    return clamp(retryAfterSeconds * 1000, 0, maxDelayMs);
  }

  const retryAt = Date.parse(retryAfterValue);
  if (Number.isNaN(retryAt)) {
    return undefined;
  }

  return clamp(retryAt - Date.now(), 0, maxDelayMs);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (() => {
    const value = (error as Error & { code?: unknown; cause?: { code?: unknown } }).code
      ?? (error as Error & { cause?: { code?: unknown } }).cause?.code;
    return typeof value === 'string' ? value.toUpperCase() : undefined;
  })();

  if (
    code &&
    [
      'ECONNABORTED',
      'ECONNREFUSED',
      'ECONNRESET',
      'EHOSTUNREACH',
      'EPIPE',
      'ETIMEDOUT',
      'ENETDOWN',
      'ENETUNREACH',
      'ENOTFOUND',
      'EAI_AGAIN',
    ].includes(code)
  ) {
    return true;
  }

  if (['APIConnectionError', 'FetchError'].includes(error.name)) {
    return true;
  }

  return /(network error|fetch failed|socket hang up|timed out|timeout|connection reset)/i.test(
    error.message,
  );
}

function isRetryableError(error: unknown): boolean {
  if (isAbortError(error)) {
    return false;
  }

  const status = getStatus(error);
  if (status === 429) {
    return true;
  }

  if (status === 401 || status === 403) {
    return false;
  }

  if (typeof status === 'number') {
    return status >= 500;
  }

  return isNetworkError(error);
}

function getBackoffDelayMs(attempt: number, opts: Required<RetryOpts>): number {
  const exponentialDelay = opts.baseDelayMs * 2 ** (attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, opts.maxDelayMs);
  const jitterFactor = 1 + (Math.random() - 0.5) * 0.4;
  return Math.round(clamp(cappedDelay * jitterFactor, 0, opts.maxDelayMs));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts?: RetryOpts,
  onRetry?: (attempt: number, error: Error) => void,
): Promise<T> {
  const resolvedOpts: Required<RetryOpts> = {
    maxAttempts: opts?.maxAttempts ?? DEFAULT_RETRY_OPTS.maxAttempts,
    baseDelayMs: opts?.baseDelayMs ?? DEFAULT_RETRY_OPTS.baseDelayMs,
    maxDelayMs: opts?.maxDelayMs ?? DEFAULT_RETRY_OPTS.maxDelayMs,
  };

  let lastError: unknown;

  for (let attempt = 1; attempt <= resolvedOpts.maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!(error instanceof Error)) {
        throw error;
      }

      if (attempt >= resolvedOpts.maxAttempts || !isRetryableError(error)) {
        throw error;
      }

      const retryAttempt = attempt;
      onRetry?.(retryAttempt, error);

      const delayMs =
        getStatus(error) === 429
          ? getRetryAfterMs(error, resolvedOpts.maxDelayMs) ?? getBackoffDelayMs(retryAttempt, resolvedOpts)
          : getBackoffDelayMs(retryAttempt, resolvedOpts);

      await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
