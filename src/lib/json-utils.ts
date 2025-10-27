export const stableStringify = (obj: unknown): string => {
  return JSON.stringify(obj, null, 2);
};

export const debounce = <F extends (...args: any[]) => void>(
  fn: F,
  ms: number
): ((...args: Parameters<F>) => void) => {
  let timeoutId: NodeJS.Timeout;
  
  return (...args: Parameters<F>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), ms);
  };
};