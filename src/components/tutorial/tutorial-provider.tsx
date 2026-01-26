"use client";
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { TutorialStep, TutorialState } from './tutorial-types';

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

export function TutorialProvider({ children }: { children: React.ReactNode }) {
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

  // Auto-start on first visit (only if not completed)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Check completion status directly
    const completed = localStorage.getItem(TUTORIAL_COMPLETION_KEY) === 'true';
    
    // Only auto-start if tutorial hasn't been completed
    if (!completed) {
      // Use a small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        // Default placeholder steps - can be replaced later
        const defaultSteps: TutorialStep[] = [
          {
            id: 'step-1',
            title: 'Welcome to DiagramWeaver',
            body: 'Click the File menu to open it. You can create new diagrams, load existing ones, and save your work here.',
            target: 'file-menu',
            requiresTargetClick: true,
            autoActionsOnNext: [{ type: 'click', target: 'file-menu' }],
          },
          {
            id: 'step-2',
            title: 'Edit menu',
            body: 'The Edit menu has actions like copy/paste and undo/redo. Press Next to open it automatically.',
            target: 'edit-menu',
            requiresTargetClick: true,
            autoActionsOnNext: [{ type: 'click', target: 'edit-menu' }],
          },
          {
            id: 'step-3',
            title: 'Tutorial complete',
            body: 'You’re all set. You can run this tutorial again any time from File → Start Tutorial.',
            target: 'canvas',
            mode: 'message',
            requiresTargetClick: false,
          },
        ];
        start(defaultSteps);
      }, 500);
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
