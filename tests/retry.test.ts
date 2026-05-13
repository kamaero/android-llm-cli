import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withRetry } from '../src/streaming/retry.js';

function makeNetworkError(message = 'network error'): Error {
  return new Error(message);
}

function makeHttpError(status: number, headers?: Headers): Error & { status: number; headers?: Headers } {
  const error = new Error(`HTTP ${status}`) as Error & { status: number; headers?: Headers };
  error.status = status;
  error.headers = headers;
  return error;
}

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('succeeds on the first call without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const onRetry = vi.fn();

    await expect(withRetry(fn, undefined, onRetry)).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('retries twice and returns the eventual success value', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(makeNetworkError())
      .mockRejectedValueOnce(makeNetworkError())
      .mockResolvedValue('ok');
    const onRetry = vi.fn();

    const resultPromise = withRetry(
      fn,
      { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
      onRetry,
    );

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('throws after the final failed attempt', async () => {
    const fn = vi.fn<() => Promise<string>>(async () => {
      throw makeNetworkError();
    });
    const onRetry = vi.fn();

    const resultPromise = withRetry(
      fn,
      { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
      onRetry,
    );
    const rejection = expect(resultPromise).rejects.toThrow('network error');

    await vi.runAllTimersAsync();

    await rejection;
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('respects Retry-After for 429 responses', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(makeHttpError(429, new Headers([['retry-after', '2']])))
      .mockResolvedValue('ok');

    const resultPromise = withRetry(
      fn,
      { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 30000 },
    );

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1999);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry 401 responses', async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue(makeHttpError(401));
    const onRetry = vi.fn();

    await expect(withRetry(fn, undefined, onRetry)).rejects.toThrow('HTTP 401');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
