"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from 'react';
import type { TutorialStep, TutorialState } from './tutorial-types';
import { getTutorialSteps } from './tutorial-steps';

const TUTORIAL_COMPLETION_KEY = 'dw:tutorial:completed:v1';

interface TutorialContextValue {
  isOpen: boolean;
  steps: TutorialStep[];
  currentIndex: number;
  start: (steps: TutorialStep[]) => void;
  next: () => void;
  prev: () => void;
  finish: () => void;
  close: () => void;
  isCompleted: () => boolean;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export function TutorialProvider({
  children,
  onLoadTutorialExample,
  onTutorialSessionStart,
  onTutorialFinish,
}: {
  children: React.ReactNode;
  /** Called when the active step includes `loadExampleId` (loads into the dedicated tutorial tab). */
  onLoadTutorialExample?: (exampleId: string) => void | Promise<void>;
  /** Called when the tutorial session starts (create/focus the `tutorial` tab before examples load). */
  onTutorialSessionStart?: () => void;
  /** Called when the tutorial UI closes (`finish()` or X / `close()`); parent should close the tutorial tab without a save prompt. */
  onTutorialFinish?: () => void;
}) {
  const [state, setState] = useState<TutorialState>({
    isOpen: false,
    steps: [],
    currentIndex: 0,
  });

  const isCompleted = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(TUTORIAL_COMPLETION_KEY) === 'true';
  }, []);

  const start = useCallback(
    (steps: TutorialStep[]) => {
      onTutorialSessionStart?.();
      setState({
        isOpen: true,
        steps,
        currentIndex: 0,
      });
    },
    [onTutorialSessionStart],
  );

  const next = useCallback(() => {
    setState(prev => {
      if (prev.currentIndex < prev.steps.length - 1) {
        return {
          ...prev,
          currentIndex: prev.currentIndex + 1,
        };
      }
      return prev;
    });
  }, []);

  const prev = useCallback(() => {
    setState(prev => {
      if (prev.currentIndex > 0) {
        return {
          ...prev,
          currentIndex: prev.currentIndex - 1,
        };
      }
      return prev;
    });
  }, []);

  const finish = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TUTORIAL_COMPLETION_KEY, 'true');
    }
    onTutorialFinish?.();
    setState({
      isOpen: false,
      steps: [],
      currentIndex: 0,
    });
  }, [onTutorialFinish]);

  const close = useCallback(() => {
    // Don't mark as completed when closing early
    onTutorialFinish?.();
    setState({
      isOpen: false,
      steps: [],
      currentIndex: 0,
    });
  }, [onTutorialFinish]);

  // Only load each tutorial JSON once per step — `onLoadTutorialExample` from the parent may change
  // identity on every render (e.g. unstable deps), which would re-fetch and reset selection on every click.
  const lastTutorialLoadKeyRef = useRef<string>('');

  // Before child effects run: refocus the dedicated tutorial tab on every step so the canvas matches
  // the tab that receives `loadExampleId` JSON (steps without a load still need the tutorial diagram visible).
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;
    if (!state.isOpen || state.steps.length === 0) return;
    onTutorialSessionStart?.();
  }, [state.currentIndex, state.isOpen, state.steps.length, onTutorialSessionStart]);

  // When the active step defines a tutorial example, load it into the dedicated tutorial tab.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!state.isOpen || state.steps.length === 0) {
      lastTutorialLoadKeyRef.current = '';
      return;
    }
    const step = state.steps[state.currentIndex];
    const id = step?.loadExampleId;
    if (!id || !onLoadTutorialExample) return;

    const key = `${state.currentIndex}:${id}`;
    if (lastTutorialLoadKeyRef.current === key) return;

    lastTutorialLoadKeyRef.current = key;
    void Promise.resolve(onLoadTutorialExample(id));
  }, [state.isOpen, state.currentIndex, state.steps, onLoadTutorialExample]);

  // Auto-start on first visit (only if not completed)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const completed = localStorage.getItem(TUTORIAL_COMPLETION_KEY) === 'true';

    if (!completed) {
      const timer = setTimeout(() => {
        start(getTutorialSteps());
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [start]);

  const value: TutorialContextValue = {
    isOpen: state.isOpen,
    steps: state.steps,
    currentIndex: state.currentIndex,
    start,
    next,
    prev,
    finish,
    close,
    isCompleted,
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutorial() {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
