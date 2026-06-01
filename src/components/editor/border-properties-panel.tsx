"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import type { BorderColorMode, BorderRolePaint, NodeBorderSpec } from "@/lib/border-types";
import { BORDER_TEMPLATE_LIST } from "@/lib/border-templates";
import { getBorderRoleDefinitions, resolveBorderRolePaint } from "@/lib/border-roles";
import { BorderPaletteGlyph } from "@/components/diagram/shapes/border-art";

export interface BorderPropertiesPanelProps {
  borderTemplateId: string | undefined;
  border: NodeBorderSpec | undefined;
  onBorderChange: (patch: Partial<NodeBorderSpec>) => void;
}

function BorderRolePaintEditor({
  templateId,
  roleId,
  label,
  colorMode,
  rolePaints,
  onRolePaintChange,
}: {
  templateId: string;
  roleId: string;
  label: string;
  colorMode: BorderColorMode;
  rolePaints?: Record<string, BorderRolePaint>;
  onRolePaintChange: (roleId: string, paint: BorderRolePaint) => void;
}) {
  const resolved = resolveBorderRolePaint(templateId, roleId, colorMode, rolePaints);
  const style = resolved.style ?? "solid";
  const isGradient = style === "gradient";

  return (
    <div className="space-y-2 rounded-md border border-border/70 bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">{label}</Label>
        <Select
          value={style}
          onValueChange={(value) => {
            if (value === "gradient") {
              onRolePaintChange(roleId, {
                style: "gradient",
                colors: resolved.colors ?? [
                  resolved.color ?? "#3b82f6",
                  resolved.color ?? "#1d4ed8",
                ],
                angle: resolved.angle ?? 135,
              });
            } else {
              onRolePaintChange(roleId, {
                style: "solid",
                color: resolved.colors?.[0] ?? resolved.color ?? "#3b82f6",
              });
            }
          }}
        >
          <SelectTrigger className="h-8 w-[6.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            <SelectItem value="solid" className="text-xs">
              Solid
            </SelectItem>
            <SelectItem value="gradient" className="text-xs">
              Gradient
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isGradient ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Start</Label>
            <ColorPicker
              value={resolved.colors?.[0] ?? "#3b82f6"}
              onChange={(value) =>
                onRolePaintChange(roleId, {
                  style: "gradient",
                  colors: [value, resolved.colors?.[1] ?? "#1d4ed8"],
                  angle: resolved.angle ?? 135,
                })
              }
              showAlpha={false}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">End</Label>
            <ColorPicker
              value={resolved.colors?.[1] ?? "#1d4ed8"}
              onChange={(value) =>
                onRolePaintChange(roleId, {
                  style: "gradient",
                  colors: [resolved.colors?.[0] ?? "#3b82f6", value],
                  angle: resolved.angle ?? 135,
                })
              }
              showAlpha={false}
            />
          </div>
        </div>
      ) : (
        <ColorPicker
          value={resolved.color ?? "#3b82f6"}
          onChange={(value) => onRolePaintChange(roleId, { style: "solid", color: value })}
          showAlpha={false}
        />
      )}
    </div>
  );
}

export function BorderPropertiesPanel({
  borderTemplateId,
  border,
  onBorderChange,
}: BorderPropertiesPanelProps) {
  const templateId = border?.templateId ?? borderTemplateId ?? "corner-diagonal-accent";
  const colorMode: BorderColorMode = border?.colorMode === "dark" ? "dark" : "light";
  const templateName =
    BORDER_TEMPLATE_LIST.find((t) => t.id === templateId)?.name ??
    templateId.replace(/-/g, " ");
  const roleDefs = getBorderRoleDefinitions(templateId);

  const handleRolePaintChange = (roleId: string, paint: BorderRolePaint) => {
    onBorderChange({
      rolePaints: {
        ...(border?.rolePaints ?? {}),
        [roleId]: paint,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <BorderPaletteGlyph
          type={`generic.border.${templateId}`}
          colorMode={colorMode}
          rolePaints={border?.rolePaints}
          className="h-14 w-20 shrink-0 rounded-md border border-border bg-background object-contain"
        />
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-tight">{templateName}</p>
          <p className="text-xs text-muted-foreground">
            Slide base frame — each color role supports solid or gradient fills.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Template</Label>
        <Select
          value={templateId}
          onValueChange={(value) => onBorderChange({ templateId: value, rolePaints: undefined })}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {BORDER_TEMPLATE_LIST.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-sm">
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Color theme</Label>
        <Select
          value={colorMode}
          onValueChange={(value) => onBorderChange({ colorMode: value as BorderColorMode })}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            <SelectItem value="light" className="text-sm">
              Light
            </SelectItem>
            <SelectItem value="dark" className="text-sm">
              Dark
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {roleDefs.length > 0 ? (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Color roles</Label>
          <div className="space-y-2">
            {roleDefs.map((role) => (
              <BorderRolePaintEditor
                key={role.id}
                templateId={templateId}
                roleId={role.id}
                label={role.label}
                colorMode={colorMode}
                rolePaints={border?.rolePaints}
                onRolePaintChange={handleRolePaintChange}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
