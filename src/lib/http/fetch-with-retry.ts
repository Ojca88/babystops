export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Reintenta con backoff exponencial en 429 (rate limit), 5xx, y errores de
// red (doFetch rechazando la promesa — timeouts de conexión, DNS, etc. —
// nunca llegan a devolver un Response, así que hay que capturarlos aparte).
export async function fetchWithRetry(doFetch: () => Promise<Response>, options: RetryOptions = {}): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 5;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const sleep = options.sleep ?? defaultSleep;

  let lastResponse: Response | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await doFetch();
      lastError = undefined;
      if (response.status !== 429 && response.status < 500) {
        return response;
      }
      lastResponse = response;
    } catch (error) {
      lastError = error;
      lastResponse = undefined;
    }

    if (attempt < maxAttempts) {
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  if (lastError) throw lastError;
  return lastResponse!;
}
