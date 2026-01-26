"use client";
import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTutorial } from './tutorial-provider';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import type { TutorialAction } from './tutorial-types';

export function TutorialOverlay() {
  const { isOpen, steps, currentIndex, next, prev, finish, close } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const targetElementRef = useRef<Element | null>(null);
  const attachedElementRef = useRef<Element | null>(null);
  const clickHandlerRef = useRef<((e: MouseEvent) => void) | null>(null);
  const lastAutoEnterStepIdRef = useRef<string | null>(null);
  const currentIndexRef = useRef<number>(0);
  const pendingNextRef = useRef<number | null>(null);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
    // Clear any pending next if we've already moved
    if (pendingNextRef.current !== null && pendingNextRef.current !== currentIndex) {
      pendingNextRef.current = null;
    }
  }, [currentIndex]);

  // Reset refs when tutorial starts or restarts
  useEffect(() => {
    if (isOpen && steps.length > 0) {
      currentIndexRef.current = currentIndex;
      pendingNextRef.current = null;
      lastAutoEnterStepIdRef.current = null;
      // Clean up any lingering click handlers
      if (clickHandlerRef.current && attachedElementRef.current) {
        attachedElementRef.current.removeEventListener('click', clickHandlerRef.current, true);
        clickHandlerRef.current = null;
        attachedElementRef.current = null;
      }
    }
  }, [isOpen, steps.length, currentIndex]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentStep = steps[currentIndex];
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;
  const requiresClick = currentStep?.requiresTargetClick ?? false;

  const safeNext = (expectedIndex: number) => {
    // Prevent double-advance: only proceed if we're still on the expected step
    // and no other next() is already pending
    if (currentIndexRef.current !== expectedIndex) return;
    if (pendingNextRef.current !== null && pendingNextRef.current !== expectedIndex) return;
    
    // Mark that we're advancing from this step
    pendingNextRef.current = expectedIndex;
    next();
  };

  const resolveElement = (target: string): Element | null => {
    if (typeof document === 'undefined') return null;

    if (!target.startsWith('[') && !target.startsWith('#') && !target.startsWith('.')) {
      return document.querySelector(`[data-tutorial-id="${target}"]`);
    }
    return document.querySelector(target);
  };

  const runAction = (action: TutorialAction): boolean => {
    if (action.type === 'click') {
      const el = resolveElement(action.target);
      if (!el) return false;
      (el as HTMLElement).click();
      return true;
    }
    return false;
  };

  // Find target element and update position
  useEffect(() => {
    if (!isOpen || !currentStep || typeof window === 'undefined') {
      setTargetRect(null);
      setPopupPosition(null);
      setTargetMissing(false);
      targetElementRef.current = null;
      return;
    }

    // Message-only step: don't dim/highlight; just center the popup.
    if (currentStep.mode === 'message') {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 20;
      const popupWidth = Math.min(320, viewportWidth - padding * 2);
      const popupHeight = 200;

      setTargetRect(null);
      setTargetMissing(false);
      setPopupPosition({
        x: Math.max(padding, (viewportWidth - popupWidth) / 2),
        y: Math.max(padding, (viewportHeight - popupHeight) / 2),
      });
      targetElementRef.current = null;
      return;
    }

    const findTarget = () => resolveElement(currentStep.target);

    const updatePosition = () => {
      const element = findTarget();
      if (!element) {
        // Try auto-actions-on-enter once per step to make targets appear (e.g. open menus).
        if (
          currentStep.autoActionsOnEnter &&
          currentStep.autoActionsOnEnter.length > 0 &&
          lastAutoEnterStepIdRef.current !== currentStep.id
        ) {
          lastAutoEnterStepIdRef.current = currentStep.id;
          currentStep.autoActionsOnEnter.forEach(runAction);
          // Allow UI to update (Radix menus render in portals)
          window.setTimeout(updatePosition, 75);
        }

        setTargetRect(null);
        setTargetMissing(true);

        // Fallback: keep the popup visible and centered so the user can continue.
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const padding = 20;
        const popupWidth = Math.min(320, viewportWidth - padding * 2);
        const popupHeight = 200;
        setPopupPosition({
          x: Math.max(padding, (viewportWidth - popupWidth) / 2),
          y: Math.max(padding, (viewportHeight - popupHeight) / 2),
        });

        targetElementRef.current = null;
        return;
      }

      lastAutoEnterStepIdRef.current = currentStep.id;
      targetElementRef.current = element;
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
      setTargetMissing(false);

      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

      // Calculate popup position (prefer right side, then left, then below)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 20;
      const popupWidth = 320;
      const popupHeight = 200;

      let x = rect.right + padding;
      let y = rect.top + rect.height / 2 - popupHeight / 2;

      // If popup would go off right edge, try left side
      if (x + popupWidth > viewportWidth - padding) {
        x = rect.left - popupWidth - padding;
      }

      // If still off screen, center horizontally
      if (x < padding) {
        x = Math.max(padding, (viewportWidth - popupWidth) / 2);
      }

      // If popup would go off bottom, adjust
      if (y + popupHeight > viewportHeight - padding) {
        y = viewportHeight - popupHeight - padding;
      }

      // If popup would go off top, adjust
      if (y < padding) {
        y = padding;
      }

      setPopupPosition({ x, y });
    };

    // Initial update
    updatePosition();

    // Update on scroll/resize
    const handleUpdate = () => {
      // Small delay to allow scroll to complete
      setTimeout(updatePosition, 100);
    };

    window.addEventListener('scroll', handleUpdate, true);
    window.addEventListener('resize', handleUpdate);

    // Also re-check periodically in case element appears later
    const interval = setInterval(() => {
      if (!targetElementRef.current || !document.contains(targetElementRef.current)) {
        updatePosition();
      }
    }, 500);

    return () => {
      window.removeEventListener('scroll', handleUpdate, true);
      window.removeEventListener('resize', handleUpdate);
      clearInterval(interval);
    };
  }, [isOpen, currentStep, currentIndex]);

  // Handle target click for requiresTargetClick steps
  useEffect(() => {
    if (!isOpen || !currentStep || !requiresClick || !targetElementRef.current) {
      if (clickHandlerRef.current && attachedElementRef.current) {
        attachedElementRef.current.removeEventListener('click', clickHandlerRef.current, true);
        clickHandlerRef.current = null;
        attachedElementRef.current = null;
      }
      return;
    }

    const expectedIndex = currentIndex;

    const handleTargetClick = (e: MouseEvent) => {
      // Do NOT stop propagation: the user must be clicking the real UI element.
      // Small delay gives the UI time to respond (e.g. menus opening) before we advance.
      window.setTimeout(() => safeNext(expectedIndex), 75);
    };

    const element = targetElementRef.current;
    element.addEventListener('click', handleTargetClick, true);
    clickHandlerRef.current = handleTargetClick;
    attachedElementRef.current = element;

    return () => {
      if (clickHandlerRef.current && element) {
        element.removeEventListener('click', clickHandlerRef.current, true);
        clickHandlerRef.current = null;
        attachedElementRef.current = null;
      }
    };
  }, [isOpen, currentStep, requiresClick, currentIndex, next]);

  if (!mounted || !isOpen || !currentStep) {
    return null;
  }

  const handleNext = () => {
    // Double-check we're still on the expected step (guard against stale closures)
    if (currentIndexRef.current !== currentIndex) return;
    
    if (isLastStep) {
      finish();
    } else {
      const expectedIndex = currentIndex;

      // If the user presses Next instead of performing the action manually,
      // run any configured actions for this step (e.g. click a menu trigger).
      if (currentStep.autoActionsOnNext && currentStep.autoActionsOnNext.length > 0) {
        currentStep.autoActionsOnNext.forEach(runAction);
        // Use a slightly longer delay to ensure the click handler (if any) has a chance to see the current state
        window.setTimeout(() => safeNext(expectedIndex), 100);
      } else {
        safeNext(expectedIndex);
      }
    }
  };

  const handlePrev = () => {
    prev();
  };

  const handleBackdropAreaClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentStep.allowBackdropClickToClose) {
      close();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] pointer-events-none"
    >
      {/* Dimmed overlay with hole for target */}
      {targetRect && (
        <>
          {/* Top overlay */}
          <div
            className="absolute bg-black/60 pointer-events-auto"
            style={{
              top: 0,
              left: 0,
              right: 0,
              height: `${targetRect.top}px`,
            }}
            onClick={handleBackdropAreaClick}
          />
          {/* Bottom overlay */}
          <div
            className="absolute bg-black/60 pointer-events-auto"
            style={{
              top: `${targetRect.bottom}px`,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={handleBackdropAreaClick}
          />
          {/* Left overlay */}
          <div
            className="absolute bg-black/60 pointer-events-auto"
            style={{
              top: `${targetRect.top}px`,
              left: 0,
              width: `${targetRect.left}px`,
              height: `${targetRect.height}px`,
            }}
            onClick={handleBackdropAreaClick}
          />
          {/* Right overlay */}
          <div
            className="absolute bg-black/60 pointer-events-auto"
            style={{
              top: `${targetRect.top}px`,
              left: `${targetRect.right}px`,
              right: 0,
              height: `${targetRect.height}px`,
            }}
            onClick={handleBackdropAreaClick}
          />
          
          {/* Highlight ring around target */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${targetRect.left - 4}px`,
              top: `${targetRect.top - 4}px`,
              width: `${targetRect.width + 8}px`,
              height: `${targetRect.height + 8}px`,
              border: '3px solid #fbbf24',
              borderRadius: '4px',
              boxShadow: '0 0 0 2px rgba(251, 191, 36, 0.3), 0 0 20px rgba(251, 191, 36, 0.5)',
            }}
          />
        </>
      )}

      {/* If the target isn't available yet, dim lightly but allow interaction */}
      {!targetRect && targetMissing && currentStep.mode !== 'message' && (
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      )}

      {/* Popup */}
      {popupPosition && (
        <div
          className="absolute bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow-xl p-4 pointer-events-auto"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            width: '320px',
            maxWidth: 'calc(100vw - 40px)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Arrow pointing to target */}
          {targetRect && (
            <div
              className="absolute w-0 h-0"
              style={{
                left: targetRect.right < popupPosition.x ? '-8px' : 'auto',
                right: targetRect.right >= popupPosition.x ? '-8px' : 'auto',
                top: '20px',
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: targetRect.right < popupPosition.x ? '8px solid #fef3c7' : 'none',
                borderLeft: targetRect.right >= popupPosition.x ? '8px solid #fef3c7' : 'none',
              }}
            />
          )}

          {/* Header */}
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 text-sm">{currentStep.title}</h3>
              <p className="text-xs text-gray-600 mt-1">{currentStep.body}</p>
            </div>
            <button
              onClick={close}
              className="ml-2 text-gray-400 hover:text-gray-600"
              aria-label="Close tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Step counter */}
          <div className="text-xs text-gray-500 mb-3">
            Step {currentIndex + 1} of {steps.length}
          </div>

          {targetMissing && (
            <div className="mb-3 text-xs text-yellow-800 bg-yellow-100 border border-yellow-200 rounded p-2">
              Target not visible yet. If this step refers to a menu or panel, open it and the highlight will appear automatically.
            </div>
          )}

          {/* Controls */}
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={isFirstStep}
              className="flex-1"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleNext}
              className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white"
            >
              {isLastStep ? 'Finish' : 'Next'}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>

          {requiresClick && (
            <div className="mt-2 text-xs text-yellow-700 text-center">
              Click the highlighted element, or press Next to do it for you
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}
