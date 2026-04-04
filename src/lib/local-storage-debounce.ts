/**
 * Debounced localStorage utility to reduce excessive writes
 *
 * This utility batches localStorage writes to improve performance,
 * especially useful for settings that change frequently (e.g., panel sizes, toggles)
 */

const debounceTimers = new Map<string, NodeJS.Timeout>();

/**
 * Debounced localStorage.setItem with customizable delay
 *
 * @param key - The localStorage key
 * @param value - The value to store
 * @param delay - Debounce delay in milliseconds (default: 500ms)
 */
export function setItemDebounced(key: string, value: string, delay: number = 500): void {
  // Clear any existing timer for this key
  const existingTimer = debounceTimers.get(key);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Set a new timer
  const timer = setTimeout(() => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error(`Failed to set localStorage key "${key}":`, error);
    }
    // Clean up the timer reference
    debounceTimers.delete(key);
  }, delay);

  debounceTimers.set(key, timer);
}

/**
 * Flush all pending debounced writes immediately
 * Useful when the page is about to unload
 */
export function flushPendingWrites(): void {
  debounceTimers.forEach((timer, key) => {
    clearTimeout(timer);
    debounceTimers.delete(key);
  });
}

/**
 * Get a value from localStorage with error handling
 *
 * @param key - The localStorage key
 * @returns The value or null if not found or error occurs
 */
export function getItemSafe(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Failed to get localStorage key "${key}":`, error);
    return null;
  }
}

/**
 * Set a value in localStorage immediately (not debounced)
 *
 * @param key - The localStorage key
 * @param value - The value to store
 * @returns true if successful, false otherwise
 */
export function setItemImmediate(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.error(`Failed to set localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Set a boolean value in localStorage (debounced)
 */
export function setBooleanDebounced(key: string, value: boolean, delay: number = 500): void {
  setItemDebounced(key, String(value), delay);
}

/**
 * Get a boolean value from localStorage
 */
export function getBooleanSafe(key: string, defaultValue: boolean = false): boolean {
  const value = getItemSafe(key);
  if (value === null) return defaultValue;
  return value === 'true';
}

/**
 * Set a JSON object in localStorage (debounced)
 */
export function setJSONDebounced<T>(key: string, value: T, delay: number = 500): void {
  try {
    setItemDebounced(key, JSON.stringify(value), delay);
  } catch (error) {
    console.error(`Failed to serialize and set localStorage key "${key}":`, error);
  }
}

/**
 * Get a JSON object from localStorage
 */
export function getJSONSafe<T>(key: string, defaultValue: T): T {
  const value = getItemSafe(key);
  if (value === null) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Failed to parse localStorage key "${key}":`, error);
    return defaultValue;
  }
}

// Flush pending writes on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushPendingWrites);
}
