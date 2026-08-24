import { describe, expect, test, vi } from "vitest";
import { fetchWithRetry } from "./fetch-with-retry";

function response(status: number): Response {
  return { status } as Response;
}

describe("fetchWithRetry", () => {
  test("returns immediately on a successful response, no retry", async () => {
    const doFetch = vi.fn().mockResolvedValue(response(200));

    const result = await fetchWithRetry(doFetch, { sleep: vi.fn() });

    expect(result.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(1);
  });

  test("retries on 429 and returns the eventual success", async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(200));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await fetchWithRetry(doFetch, { sleep });

    expect(result.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(3);
  });

  test("retries on 5xx the same as 429", async () => {
    const doFetch = vi.fn().mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(200));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await fetchWithRetry(doFetch, { sleep });

    expect(result.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  test("does not retry on a non-429 4xx error", async () => {
    const doFetch = vi.fn().mockResolvedValue(response(404));
    const sleep = vi.fn();

    const result = await fetchWithRetry(doFetch, { sleep });

    expect(result.status).toBe(404);
    expect(doFetch).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test("gives up after maxAttempts and returns the last response", async () => {
    const doFetch = vi.fn().mockResolvedValue(response(429));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await fetchWithRetry(doFetch, { sleep, maxAttempts: 3 });

    expect(result.status).toBe(429);
    expect(doFetch).toHaveBeenCalledTimes(3);
  });

  test("backoff delay doubles on each successive attempt", async () => {
    const doFetch = vi
      .fn()
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(429))
      .mockResolvedValueOnce(response(200));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await fetchWithRetry(doFetch, { sleep, baseDelayMs: 100 });

    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
  });

  test("retries a network-level failure (fetch() rejecting, not returning a Response)", async () => {
    const doFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connect Timeout Error"))
      .mockResolvedValueOnce(response(200));
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await fetchWithRetry(doFetch, { sleep });

    expect(result.status).toBe(200);
    expect(doFetch).toHaveBeenCalledTimes(2);
  });

  test("re-throws the last network error after exhausting all attempts", async () => {
    const doFetch = vi.fn().mockRejectedValue(new Error("Connect Timeout Error"));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(fetchWithRetry(doFetch, { sleep, maxAttempts: 3 })).rejects.toThrow("Connect Timeout Error");
    expect(doFetch).toHaveBeenCalledTimes(3);
  });
});
