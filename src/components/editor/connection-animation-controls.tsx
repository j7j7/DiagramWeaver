"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { DiagramConnectionData } from "@/lib/types";
import { clampConnectionAnimation, toConnectionAnimationPatch, type ConnectionAnimationShape } from "@/lib/connection-animation";
import { ColorPicker } from "@/components/ui/color-picker";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type BulkDirection = 'outbound' | 'inbound';

interface ConnectionAnimationControlsProps {
  connection: DiagramConnectionData;
  inheritedConnectionColor: string;
  onConnectionUpdate: (from: string, to: string, updates: { animation?: DiagramConnectionData['animation'] }) => void;
  compact?: boolean;
  isReadOnly?: boolean;
  onBulkApply?: (sourceId: string, direction: BulkDirection, animation: DiagramConnectionData['animation']) => void;
}

export function ConnectionAnimationControls({
  connection,
  inheritedConnectionColor,
  onConnectionUpdate,
  compact = false,
  isReadOnly = false,
  onBulkApply,
}: ConnectionAnimationControlsProps) {
  const animation = useMemo(() => clampConnectionAnimation(connection.animation), [connection.animation]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDirection, setPendingDirection] = useState<BulkDirection | null>(null);
  const [outboundChecked, setOutboundChecked] = useState(false);
  const [inboundChecked, setInboundChecked] = useState(false);

  useEffect(() => {
    if (!animation.enabled) {
      setOutboundChecked(false);
      setInboundChecked(false);
    }
  }, [animation.enabled]);

  const updateAnimation = (patch: Partial<DiagramConnectionData['animation']>) => {
    if (isReadOnly) return;
    onConnectionUpdate(connection.from, connection.to, {
      animation: toConnectionAnimationPatch({
        ...animation,
        ...patch,
      }),
    });
  };

  const handleShapeChange = (value: ConnectionAnimationShape) => {
    updateAnimation({ shape: value });
  };

  const handleEnabledToggle = (checked: boolean) => {
    updateAnimation({ enabled: checked });
  };

  const handleSpeedChange = (value: number) => {
    updateAnimation({ speed: value });
  };

  const handleSizeChange = (value: number) => {
    if (!Number.isFinite(value)) return;
    updateAnimation({ size: value });
  };

  const handleAutoCountToggle = (checked: boolean) => {
    updateAnimation({ autoCount: checked });
  };

  const handleShapeCountChange = (value: number) => {
    updateAnimation({ shapeCount: value });
  };

  const handleSpacingChange = (value: number) => {
    updateAnimation({ spacing: value });
  };

  const handleColorChange = (color: string) => {
    updateAnimation({ color: color || undefined });
  };

  const triggerBulkConfirm = (direction: BulkDirection, checked: boolean) => {
    if (!checked || !onBulkApply || isReadOnly) {
      if (direction === 'outbound') setOutboundChecked(false);
      if (direction === 'inbound') setInboundChecked(false);
      return;
    }

    if (direction === 'outbound') setOutboundChecked(true);
    if (direction === 'inbound') setInboundChecked(true);
    setPendingDirection(direction);
    setConfirmOpen(true);
  };

  const rollbackBulkChecks = () => {
    setOutboundChecked(false);
    setInboundChecked(false);
    setPendingDirection(null);
    setConfirmOpen(false);
  };

  const confirmBulkApply = () => {
    if (!pendingDirection || !onBulkApply) {
      rollbackBulkChecks();
      return;
    }
    onBulkApply(connection.from, pendingDirection, toConnectionAnimationPatch(animation));
    rollbackBulkChecks();
  };

  const sectionClass = compact ? "space-y-2" : "space-y-3";
  const labelClass = compact
    ? "text-xs text-muted-foreground"
    : "text-sm font-medium text-foreground";
  const rowLabelClass = compact
    ? "text-xs text-muted-foreground whitespace-nowrap"
    : "text-sm font-medium text-foreground whitespace-nowrap";
  const selectTriggerClass = compact ? "h-7 w-28 text-xs" : "h-9 min-w-[7rem] text-sm";
  const numberInputClass = compact ? "h-7 w-14 text-xs text-center" : "h-9 w-16 text-sm text-center";
  const numberInputClassWide = compact ? "h-7 w-16 text-xs text-center" : "h-9 w-16 text-sm text-center";
  const controlsDisabled = isReadOnly || !animation.enabled;
  const connectionThickness = connection.lineWidth || 2.5;
  const computedShapeWidth = animation.size * 2 * connectionThickness;
  const formattedShapeWidth = Number.isInteger(computedShapeWidth)
    ? computedShapeWidth.toString()
    : computedShapeWidth.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  const gridGap = compact ? "gap-x-2 gap-y-2" : "gap-x-3 gap-y-2.5";
  const colClass = "space-y-2.5 min-w-0";
  const rightColClass = compact
    ? "space-y-2.5 min-w-0 border-l border-border pl-2"
    : "space-y-2.5 min-w-0 border-l border-border pl-3";

  return (
    <div className={sectionClass}>
      <div className="flex items-center justify-between gap-2">
        <Label className={labelClass}>Enable animation</Label>
        <Checkbox
          checked={animation.enabled}
          onCheckedChange={(checked) => handleEnabledToggle(checked === true)}
          disabled={isReadOnly}
        />
      </div>

      {animation.enabled && (
        <>
          <div className={`grid grid-cols-2 ${gridGap} items-start`}>
            <div className={colClass}>
              <div className="space-y-1.5">
                <Label className={labelClass}>Animated shapes</Label>
                <Select value={animation.shape} onValueChange={(value) => handleShapeChange(value as ConnectionAnimationShape)} disabled={controlsDisabled}>
                  <SelectTrigger className={`${selectTriggerClass} w-full max-w-full`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="z-[80]">
                    <SelectItem value="dot">Dot</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="arrow">Arrow</SelectItem>
                    <SelectItem value="triangle">Triangle</SelectItem>
                    <SelectItem value="hexagon">Hexagon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className={rowLabelClass}>Speed</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[animation.speed]}
                    onValueChange={(values) => handleSpeedChange(values[0])}
                    min={-100}
                    max={100}
                    step={5}
                    className="flex-1"
                    disabled={controlsDisabled}
                  />
                  <Input
                    type="number"
                    className={numberInputClassWide}
                    min={-100}
                    max={100}
                    step={5}
                    value={animation.speed}
                    onChange={(e) => handleSpeedChange(parseInt(e.target.value || '0', 10))}
                    disabled={controlsDisabled}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className={rowLabelClass}>Shape size</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[animation.size]}
                    onValueChange={(values) => handleSizeChange(values[0])}
                    min={0}
                    max={10}
                    step={0.5}
                    className="flex-1"
                    disabled={controlsDisabled}
                  />
                  <Input
                    type="number"
                    className={numberInputClass}
                    min={0}
                    max={10}
                    step={0.5}
                    value={animation.size}
                    onChange={(e) => handleSizeChange(parseFloat(e.target.value || '0'))}
                    disabled={controlsDisabled}
                  />
                </div>
              </div>
              <p className={compact ? "text-[11px] text-muted-foreground leading-snug" : "text-xs text-muted-foreground leading-snug"}>
                Shape width = size × 2 × connection thickness ({animation.size} × 2 × {connectionThickness} = {formattedShapeWidth}px)
              </p>

              <div className="flex items-center justify-between gap-2">
                <Label className={labelClass}>Auto shape count</Label>
                <Checkbox
                  checked={animation.autoCount}
                  onCheckedChange={(checked) => handleAutoCountToggle(checked === true)}
                  disabled={controlsDisabled}
                />
              </div>

              {!animation.autoCount && (
                <div className="space-y-1">
                  <Label className={rowLabelClass}>Shape count</Label>
                  <div className="flex items-center gap-2">
                    <Slider
                      value={[animation.shapeCount]}
                      onValueChange={(values) => handleShapeCountChange(values[0])}
                      min={0}
                      max={2000}
                      step={1}
                      className="flex-1"
                      disabled={controlsDisabled}
                    />
                    <Input
                      type="number"
                      className={numberInputClass}
                      min={0}
                      max={2000}
                      step={1}
                      value={animation.shapeCount}
                      onChange={(e) => handleShapeCountChange(parseInt(e.target.value || '0', 10))}
                      disabled={controlsDisabled}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className={rightColClass}>
              <div className="space-y-1">
                <Label className={rowLabelClass}>Shape color</Label>
                <ColorPicker
                  value={animation.color || inheritedConnectionColor}
                  onChange={(color) => {
                    if (controlsDisabled) return;
                    handleColorChange(color);
                  }}
                  placeholder={inheritedConnectionColor}
                  showAlpha
                  allowTransparent
                />
              </div>

              <div className="space-y-1">
                <Label className={rowLabelClass}>Shape-size spacing</Label>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[animation.spacing]}
                    onValueChange={(values) => handleSpacingChange(values[0])}
                    min={0}
                    max={10}
                    step={0.5}
                    className="flex-1"
                    disabled={controlsDisabled}
                  />
                  <Input
                    type="number"
                    className={numberInputClassWide}
                    min={0}
                    max={10}
                    step={0.5}
                    value={animation.spacing}
                    onChange={(e) => handleSpacingChange(parseFloat(e.target.value || '0'))}
                    disabled={controlsDisabled}
                  />
                </div>
              </div>
            </div>
          </div>

          {onBulkApply && (
            <div className="space-y-2 border-t border-border pt-2">
              <div className="flex items-center justify-between gap-2">
                <Label className={labelClass}>Apply to all outbound of source</Label>
                <Checkbox
                  checked={outboundChecked}
                  onCheckedChange={(checked) => triggerBulkConfirm('outbound', checked === true)}
                  disabled={controlsDisabled}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className={labelClass}>Apply to all inbound of source</Label>
                <Checkbox
                  checked={inboundChecked}
                  onCheckedChange={(checked) => triggerBulkConfirm('inbound', checked === true)}
                  disabled={controlsDisabled}
                />
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => {
        if (!open) rollbackBulkChecks();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply animation settings?</AlertDialogTitle>
            <AlertDialogDescription>
              Continue to apply animation color, size, shape count, spacing, and speed to all {pendingDirection === 'outbound' ? 'outbound' : 'inbound'} connections for this source element.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={rollbackBulkChecks}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkApply}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
