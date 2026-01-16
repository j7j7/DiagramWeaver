import { useState, useEffect } from "react";

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  itemType: 'node' | 'zone';
  itemId: string;
}

interface UseCanvasContextMenuOptions {
  isReadOnly?: boolean;
}

export function useCanvasContextMenu({ isReadOnly = false }: UseCanvasContextMenuOptions = {}) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    itemType: 'node',
    itemId: ''
  });

  const handleContextMenu = (event: React.MouseEvent, itemId: string, itemType: 'node' | 'zone') => {
    if (isReadOnly) return;
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY,
      itemType,
      itemId
    });
  };

  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // Close context menu when clicking outside
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };

    if (contextMenu.visible) {
      // Use setTimeout to avoid immediate closure on right-click
      const timeoutId = setTimeout(() => {
        document.addEventListener('click', handleGlobalClick);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('click', handleGlobalClick);
      };
    }
  }, [contextMenu.visible, closeContextMenu]);

  return {
    contextMenu,
    handleContextMenu,
    closeContextMenu,
  };
}

