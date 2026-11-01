const POLL_INTERVAL_MS = 500;

/**
 * Reads until the value satisfies `until`, or fails showing the last value
 * read. The saga is asynchronous: a step waits for a state with a deadline
 * instead of reading it once, and a timeout says what was there instead.
 */
export async function waitFor<T>(
  description: string,
  read: () => Promise<T>,
  until: (value: T) => boolean,
  timeoutMs = 30_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | undefined;
  let lastError: unknown;

  for (;;) {
    try {
      last = await read();
      if (until(last)) return last;
    } catch (err) {
      lastError = err;
    }
    if (Date.now() >= deadline) {
      const seen = lastError ? String(lastError) : JSON.stringify(last);
      throw new Error(`timed out after ${timeoutMs / 1000}s waiting for ${description}; last seen: ${seen}`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
