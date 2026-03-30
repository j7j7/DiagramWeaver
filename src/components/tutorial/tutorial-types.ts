export type TutorialAction =
  | {
      type: 'click';
      /**
       * CSS selector or data-tutorial-id value.
       * If it doesn't start with [, #, or ., it will be treated as a data-tutorial-id.
       */
      target: string;
    };

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  target: string; // CSS selector or data-tutorial-id
  /** Shown above the title when the tutorial is split into sections (e.g. chapter labels). */
  sectionLabel?: string;
  /** Loads `/public/examples/tutorial/{id}.json` into the active tab when the step is shown. */
  loadExampleId?: string;
  /**
   * - focus: dim + highlight a target (default)
   * - message: show a message without dimming/highlight
   */
  mode?: 'focus' | 'message';
  /**
   * For `mode: 'message'`, where to place the card. Default `center` can sit on top of the diagram
   * (e.g. tutorial shapes in the middle of the canvas); use `bottom-right` when the user must
   * click or drag on the canvas during this step.
   */
  messagePopupAnchor?: 'center' | 'bottom-right' | 'top-right';
  requiresTargetClick?: boolean; // If true, user must click the target to advance
  /**
   * If true, dimmed backdrop regions capture clicks (closes tutorial on click).
   * Default false: dim is visual-only so pointer events reach the canvas (needed for drag from sidebar, etc.).
   */
  allowBackdropClickToClose?: boolean;
  /**
   * Actions to perform automatically when the user presses Next on this step
   * (used when the user doesn't want to perform the action manually).
   */
  autoActionsOnNext?: TutorialAction[];
  /**
   * Actions to perform automatically when the step becomes active.
   * Useful for opening menus/panels so the target becomes available.
   */
  autoActionsOnEnter?: TutorialAction[];
}

export interface TutorialState {
  isOpen: boolean;
  steps: TutorialStep[];
  currentIndex: number;
}
