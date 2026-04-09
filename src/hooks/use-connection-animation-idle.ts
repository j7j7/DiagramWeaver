import { useCallback, useEffect, useRef, useState } from 'react';

/** No canvas cursor movement for this long → pause connection line animations (effective off) while user preference stays on. */
export const CONNECTION_ANIMATION_IDLE_MS = 20_000;

export function useConnectionAnimationIdlePause(animationConnectionsUserEnabled: boolean) {
  const [idlePaused, setIdlePaused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userEnabledRef = useRef(animationConnectionsUserEnabled);
  userEnabledRef.current = animationConnectionsUserEnabled;

  const clearTimers = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleIdle = useCallback(() => {
    clearTimers();
    if (!userEnabledRef.current) return;
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setIdlePaused(true);
    }, CONNECTION_ANIMATION_IDLE_MS);
  }, [clearTimers]);

  const onCanvasActivity = useCallback(() => {
    if (!userEnabledRef.current) return;
    setIdlePaused(false);
    scheduleIdle();
  }, [scheduleIdle]);

  useEffect(() => {
    if (!animationConnectionsUserEnabled) {
      clearTimers();
      setIdlePaused(false);
    }
  }, [animationConnectionsUserEnabled, clearTimers]);

  useEffect(() => {
    if (!animationConnectionsUserEnabled) return;
    scheduleIdle();
    return () => clearTimers();
  }, [animationConnectionsUserEnabled, scheduleIdle, clearTimers]);

  return { idlePaused, onCanvasActivity };
}
