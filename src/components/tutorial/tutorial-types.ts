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
  /**
   * - focus: dim + highlight a target (default)
   * - message: show a centered message without dimming/highlight
   */
  mode?: 'focus' | 'message';
  requiresTargetClick?: boolean; // If true, user must click the target to advance
  allowBackdropClickToClose?: boolean; // If true, clicking backdrop closes tutorial
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
