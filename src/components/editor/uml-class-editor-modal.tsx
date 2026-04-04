"use client";

import React, { useRef, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { X, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DiagramNodeData } from "@/lib/types";

interface UmlClassEditorModalProps {
  x: number;
  y: number;
  visible: boolean;
  onClose: () => void;
  node: DiagramNodeData | null;
  onSave: (nodeId: string, umlClass: { name: string; attributes: string[]; methods: string[] }) => void;
  isReadOnly?: boolean;
}

export { computeUmlClassDimensions } from "@/lib/uml-utils";

export function UmlClassEditorModal({
  x,
  y,
  visible,
  onClose,
  node,
  onSave,
  isReadOnly = false,
}: UmlClassEditorModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [name, setName] = useState("");
  const [attributes, setAttributes] = useState<string[]>([]);
  const [methods, setMethods] = useState<string[]>([]);

  const uml = (node as any)?.umlClass;

  useEffect(() => {
    if (visible && node) {
      const u = uml || {};
      setName(u.name ?? "name");
      setAttributes(u.attributes?.length ? [...u.attributes] : ["attributes"]);
      setMethods(u.methods?.length ? [...u.methods] : ["methods"]);
    }
  }, [visible, node, uml?.name, uml?.attributes, uml?.methods]);

  useEffect(() => {
    if (visible) {
      const modalWidth = 340;
      const modalHeight = 420;
      const padding = 8;
      let posX = x;
      let posY = y;
      if (x + modalWidth > window.innerWidth - padding)
        posX = Math.max(padding, window.innerWidth - modalWidth - padding);
      if (y + modalHeight > window.innerHeight - padding)
        posY = Math.max(padding, window.innerHeight - modalHeight - padding);
      if (posX < padding) posX = padding;
      if (posY < padding) posY = padding;
      setPosition({ x: posX, y: posY });
    }
  }, [visible, x, y]);

  // Focus management: save and restore focus
  useEffect(() => {
    if (visible) {
      // Save the currently focused element
      previousActiveElementRef.current = document.activeElement as HTMLElement;

      // Focus the first focusable element in the modal
      const focusableElement = panelRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      focusableElement?.focus();

      // Trap focus within the modal
      const handleTab = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const focusableElements = panelRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      };

      document.addEventListener('keydown', handleTab);

      return () => {
        document.removeEventListener('keydown', handleTab);
        // Restore focus to the previously focused element
        previousActiveElementRef.current?.focus();
      };
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [visible, onClose]);

  const handleSave = () => {
    if (!node || isReadOnly) return;
    const cleanName = name.trim() || "name";
    const cleanAttrs = attributes
      .map((s) => s.trim())
      .filter(Boolean)
      .length
      ? attributes.map((s) => s.trim()).filter(Boolean)
      : ["attributes"];
    const cleanMethods = methods
      .map((s) => s.trim())
      .filter(Boolean)
      .length
      ? methods.map((s) => s.trim()).filter(Boolean)
      : ["methods"];
    onSave(node.id, { name: cleanName, attributes: cleanAttrs, methods: cleanMethods });
    onClose();
  };

  const addAttribute = () => setAttributes((prev) => [...prev, ""]);
  const removeAttribute = (i: number) =>
    setAttributes((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const updateAttribute = (i: number, v: string) =>
    setAttributes((prev) => prev.map((a, idx) => (idx === i ? v : a)));

  const addMethod = () => setMethods((prev) => [...prev, ""]);
  const removeMethod = (i: number) =>
    setMethods((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  const updateMethod = (i: number, v: string) =>
    setMethods((prev) => prev.map((m, idx) => (idx === i ? v : m)));

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 w-screen h-screen z-[60]" style={{ pointerEvents: "auto" }}>
      <Draggable
        nodeRef={panelRef}
        position={position}
        onStop={(_e, data) => setPosition({ x: data.x, y: data.y })}
        handle=".uml-modal-drag-handle"
      >
        <div
          ref={panelRef}
          className="fixed w-[340px] rounded-md border border-border bg-popover shadow-lg p-0 z-[70]"
        >
          <div className="uml-modal-drag-handle flex items-center justify-between p-3 border-b cursor-move">
            <h3 className="font-semibold text-sm">Edit UML Class</h3>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>
          <div className="p-4 space-y-4 max-h-[380px] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Class name"
                className="h-8 text-sm"
                disabled={isReadOnly}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Attributes</label>
                {!isReadOnly && (
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addAttribute}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {attributes.map((attr, i) => (
                  <div key={i} className="flex gap-1">
                    <Input
                      value={attr}
                      onChange={(e) => updateAttribute(i, e.target.value)}
                      placeholder={`Attribute ${i + 1}`}
                      className="h-7 text-xs flex-1 min-w-0"
                      disabled={isReadOnly}
                    />
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeAttribute(i)}
                        disabled={attributes.length <= 1}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Methods</label>
                {!isReadOnly && (
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={addMethod}>
                    <Plus className="w-3 h-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                {methods.map((method, i) => (
                  <div key={i} className="flex gap-1">
                    <Input
                      value={method}
                      onChange={(e) => updateMethod(i, e.target.value)}
                      placeholder={`Method ${i + 1}`}
                      className="h-7 text-xs flex-1 min-w-0"
                      disabled={isReadOnly}
                    />
                    {!isReadOnly && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMethod(i)}
                        disabled={methods.length <= 1}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {!isReadOnly && (
            <div className="p-3 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="default" size="sm" onClick={handleSave}>
                Save
              </Button>
            </div>
          )}
        </div>
      </Draggable>
    </div>
  );
}
