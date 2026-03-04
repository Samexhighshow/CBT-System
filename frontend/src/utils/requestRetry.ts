export const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

export const isRetriableRequestError = (error: any): boolean => {
  if (!error?.response) return true;
  const status = Number(error.response.status || 0);
  return status === 429 || (status >= 500 && status <= 599);
};

interface RetryOptions {
  delaysMs?: number[];
  shouldRetry?: (error: any) => boolean;
}

export const runWithRetry = async <T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> => {
  const delaysMs = options.delaysMs ?? [0, 600, 1400];
  const shouldRetry = options.shouldRetry ?? isRetriableRequestError;

  let lastError: any;

  for (let index = 0; index < delaysMs.length; index += 1) {
    const delay = delaysMs[index];
    if (delay > 0) {
      await wait(delay);
    }

    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const canRetry = shouldRetry(error) && index < delaysMs.length - 1;
      if (!canRetry) {
        throw error;
      }
    }
  }

  throw lastError;
};
