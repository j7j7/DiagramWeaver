import type { TutorialStep } from './tutorial-types';

/**
 * Section-based interactive tutorial: each block can load a dedicated diagram under
 * `/public/examples/tutorial/` when the user reaches a step with `loadExampleId`.
 */
export function getTutorialSteps(): TutorialStep[] {
  return [
    {
      id: 'a-welcome',
      title: 'Welcome to DiagramWeaver',
      body: 'This walkthrough is split into short sections with sample diagrams loaded as you go. Close anytime with the X.',
      target: 'canvas',
      mode: 'message',
      loadExampleId: 'tutorial-a-orientation',
      sectionLabel: 'A — Orientation',
    },
    {
      id: 'a-top-bar',
      title: 'Top bar',
      body: 'Use File, Edit, and Layout for document actions, editing, and alignment. Zoom and cursor position appear on the right.',
      target: 'main-menubar',
    },
    {
      id: 'a-canvas',
      title: 'Canvas',
      body: 'Pan with right-drag, zoom with the wheel, and drag on empty space to marquee-select multiple items.',
      target: 'canvas',
    },
    {
      id: 'a-sidebar',
      title: 'Resource sidebar',
      body: 'Browse icons and shapes here. Drag onto the canvas or double-click to place at the center.',
      target: 'component-sidebar',
    },
    {
      id: 'b-intro',
      title: 'Diagram content',
      body: 'A new sample with three objects (Object A, Object B, Object C) is loaded. Click one object, then Shift+click another to multi-select.',
      target: 'canvas',
      mode: 'message',
      messagePopupAnchor: 'bottom-right',
      loadExampleId: 'tutorial-b-content',
      sectionLabel: 'B — Diagram content',
    },
    {
      id: 'b-selection',
      title: 'Selection',
      body: 'Selected items show the context toolbar. Drag selected objects together to move them as a group.',
      target: 'canvas',
    },
    {
      id: 'c-intro',
      title: 'Connections',
      body:
        'Added a connection between Object A and Object B. To add a connection from Object A to Object C: click Object A to select it, then click the green (+) icon at the top right. Then click Object C to make a connection between the two. This can also be accessed from the right-click object menu.',
      target: 'canvas',
      mode: 'message',
      messagePopupAnchor: 'bottom-right',
      sectionLabel: 'C — Connections',
    },
    {
      id: 'c-edit',
      title: 'Edit menu',
      body: 'Undo, redo, copy, and paste live here (Ctrl+Z / Ctrl+Shift+Z).',
      target: 'edit-menu',
      requiresTargetClick: true,
      autoActionsOnNext: [{ type: 'click', target: 'edit-menu' }],
    },
    {
      id: 'j-done',
      title: 'You are set',
      body: 'Use Help for Keyboard shortcuts, About, or run this Interactive tutorial again when you need a refresher.',
      target: 'canvas',
      mode: 'message',
    },
  ];
}
