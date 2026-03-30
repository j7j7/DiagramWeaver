"use client";
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
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
}: {
  children: React.ReactNode;
  /** Called when the active step includes `loadExampleId` (replaces the active tab diagram). */
  onLoadTutorialExample?: (exampleId: string) => void | Promise<void>;
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

  const start = useCallback((steps: TutorialStep[]) => {
    setState({
      isOpen: true,
      steps,
      currentIndex: 0,
    });
  }, []);

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
    setState({
      isOpen: false,
      steps: [],
      currentIndex: 0,
    });
  }, []);

  const close = useCallback(() => {
    // Don't mark as completed when closing early
    setState({
      isOpen: false,
      steps: [],
      currentIndex: 0,
    });
  }, []);

  // Only load each tutorial JSON once per step — `onLoadTutorialExample` from the parent may change
  // identity on every render (e.g. unstable deps), which would re-fetch and reset selection on every click.
  const lastTutorialLoadKeyRef = useRef<string>('');

  // When the active step defines a tutorial example, load it into the editor (active tab).
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
