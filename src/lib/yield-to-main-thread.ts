/** Cooperatively yield so pointer / pan events can run between heavy capture steps. */
export async function yieldToMainThread(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
}
