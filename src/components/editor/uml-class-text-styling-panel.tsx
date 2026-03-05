"use client";

import React, { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ColorPicker } from "@/components/ui/color-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Type, AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, X } from "lucide-react";
import Draggable from "react-draggable";
import {
  COMMON_FONT_FAMILIES,
} from "@/lib/text-styling";
import type { UmlClassTextStyling, UmlClassCompartmentStyle } from "@/lib/uml-text-styling";

interface UmlClassTextStylingPanelProps {
  styling: Partial<UmlClassTextStyling>;
  onStylingChange: (styling: Partial<UmlClassTextStyling>) => void;
  onReset?: () => void;
  onClose?: () => void;
}

function CompartmentFields({
  compartment,
  onChange,
}: {
  compartment: Partial<UmlClassCompartmentStyle>;
  onChange: (s: Partial<UmlClassCompartmentStyle>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Font</Label>
        <Select
          value={compartment.fontFamily || ""}
          onValueChange={(v) => onChange({ fontFamily: v })}
        >
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Font" />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {COMMON_FONT_FAMILIES.map((f) => (
              <SelectItem key={f} value={f} className="text-xs">
                <span style={{ fontFamily: f }}>{f.split(",")[0]}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Size: {compartment.fontSize ?? 12}px</Label>
        <Slider
          min={8}
          max={24}
          step={1}
          value={[compartment.fontSize ?? 12]}
          onValueChange={([v]) => onChange({ fontSize: v })}
          className="w-full"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Alignment</Label>
        <div className="flex gap-1">
          {[
            { v: "left" as const, Icon: AlignLeft },
            { v: "center" as const, Icon: AlignCenter },
            { v: "right" as const, Icon: AlignRight },
            { v: "full" as const, Icon: AlignJustify },
          ].map(({ v, Icon }) => (
            <Button
              key={v}
              variant={compartment.textJustify === v ? "default" : "outline"}
              size="sm"
              className="h-7 px-2"
              onClick={() => onChange({ textJustify: v })}
            >
              <Icon className="w-3 h-3" />
            </Button>
          ))}
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Colour</Label>
        <ColorPicker
          value={compartment.textColor || "#1e293b"}
          onChange={(v) => onChange({ textColor: v })}
          placeholder="#1e293b"
          showAlpha={false}
        />
      </div>
    </div>
  );
}

export const UmlClassTextStylingPanel = React.memo(function UmlClassTextStylingPanel({
  styling,
  onStylingChange,
  onReset,
  onClose,
}: UmlClassTextStylingPanelProps) {
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isMounted, setIsMounted] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dw:uml-text-styling:position");
      if (saved) {
        try {
          setPosition(JSON.parse(saved));
        } catch (_) {}
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && isMounted) {
      try {
        localStorage.setItem("dw:uml-text-styling:position", JSON.stringify(position));
      } catch (_) {}
    }
  }, [position, isMounted]);

  return (
    <Draggable
      nodeRef={nodeRef}
      position={position}
      onStop={(_, data) => setPosition({ x: data.x, y: data.y })}
    >
      <div
        ref={nodeRef}
        className="fixed top-20 left-20 z-50 bg-popover border border-border rounded-lg shadow-lg w-72 cursor-move"
      >
        <div className="flex items-center justify-between p-2 border-b">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4" />
            <h3 className="font-semibold text-sm">UML Class Text</h3>
          </div>
          <div className="flex gap-1">
            {onReset && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onReset}>
                <Minus className="w-3 h-3" />
              </Button>
            )}
            {onClose && (
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onClose}>
                <X className="w-3 h-4" />
              </Button>
            )}
          </div>
        </div>
        <div className="p-2">
          <Tabs defaultValue="name" className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-8">
              <TabsTrigger value="name" className="text-xs px-2">Name</TabsTrigger>
              <TabsTrigger value="attributes" className="text-xs px-2">Attrs</TabsTrigger>
              <TabsTrigger value="methods" className="text-xs px-2">Methods</TabsTrigger>
              <TabsTrigger value="divider" className="text-xs px-2">Line</TabsTrigger>
            </TabsList>
            <TabsContent value="name">
              <CompartmentFields
                compartment={styling.name || {}}
                onChange={(s) => onStylingChange({ name: { ...(styling.name || {}), ...s } })}
              />
            </TabsContent>
            <TabsContent value="attributes">
              <CompartmentFields
                compartment={styling.attributes || {}}
                onChange={(s) => onStylingChange({ attributes: { ...(styling.attributes || {}), ...s } })}
              />
            </TabsContent>
            <TabsContent value="methods">
              <CompartmentFields
                compartment={styling.methods || {}}
                onChange={(s) => onStylingChange({ methods: { ...(styling.methods || {}), ...s } })}
              />
            </TabsContent>
            <TabsContent value="divider">
              <div className="space-y-2 pt-1">
                <Label className="text-xs">
                  Divider line width: {styling.dividerLineWidth ?? 1}px
                </Label>
                <Slider
                  min={0.5}
                  max={4}
                  step={0.5}
                  value={[styling.dividerLineWidth ?? 1]}
                  onValueChange={([v]) => onStylingChange({ dividerLineWidth: v })}
                  className="w-full"
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Draggable>
  );
});
