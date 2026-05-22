"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import {
  getProfileCardRegions,
  parseProfileHeroHeightPct,
  applyProfileHeroHeightPct,
  updateProfileElementStyle,
  PROFILE_HERO_ID,
  PROFILE_TITLE_ID,
  PROFILE_SUBTITLE_ID,
  isProfileFeatureCard,
} from "@/lib/card-profile";
import {
  getCompactHorizontalRegions,
  parseCompactAvatarSize,
  applyCompactAvatarSize,
  updateCompactElementStyle,
  COMPACT_AVATAR_ID,
  COMPACT_NAME_ID,
  COMPACT_STATUS_ID,
} from "@/lib/card-compact-horizontal";
import { CardFillStyleControls } from "./card-fill-style-controls";

export interface CardPropertiesPanelProps {
  cardTemplateId?: string;
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}

function ProfileCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { hero, title, subtitle } = getProfileCardRegions(elements);
  const heroPct = parseProfileHeroHeightPct(hero);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateProfileElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Profile card regions. Use the main Background section for the lower area fill. Drag the handle
        between the top strip and body on the canvas to resize the hero area.
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Top strip height</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{Math.round(heroPct)}%</span>
        </div>
        <Slider
          min={15}
          max={85}
          step={1}
          value={[Math.round(heroPct)]}
          onValueChange={([v]) => onElementsChange(applyProfileHeroHeightPct(elements, v))}
          className="w-full"
        />
      </div>

      {hero ? (
        <CardFillStyleControls
          label="Top fill"
          style={hero.style}
          onChange={(style) => setRegionStyle(PROFILE_HERO_ID, style)}
        />
      ) : null}

      {title ? (
        <CardFillStyleControls
          label="Title segment"
          style={title.style}
          onChange={(style) => setRegionStyle(PROFILE_TITLE_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {subtitle ? (
        <CardFillStyleControls
          label="Description segment"
          style={subtitle.style}
          onChange={(style) => setRegionStyle(PROFILE_SUBTITLE_ID, style)}
          supportsMesh={false}
        />
      ) : null}
    </div>
  );
}

function CompactHorizontalCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { avatar, name, status } = getCompactHorizontalRegions(elements);
  const avatarSize = parseCompactAvatarSize(avatar);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateCompactElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Compact horizontal layout — icon on the left, text on the right. Use{" "}
        <span className="font-medium">Background</span> above for the card fill. Drop an icon onto the
        circle on the canvas, or click it to style the icon tile.
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Icon size</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{avatarSize}px</span>
        </div>
        <Slider
          min={28}
          max={72}
          step={1}
          value={[avatarSize]}
          onValueChange={([v]) => onElementsChange(applyCompactAvatarSize(elements, v))}
          className="w-full"
        />
      </div>

      {avatar ? (
        <CardFillStyleControls
          label="Icon region fill"
          style={avatar.style}
          onChange={(style) => setRegionStyle(COMPACT_AVATAR_ID, style)}
        />
      ) : null}

      {name ? (
        <CardFillStyleControls
          label="Primary text segment"
          style={name.style}
          onChange={(style) => setRegionStyle(COMPACT_NAME_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {status ? (
        <CardFillStyleControls
          label="Secondary text segment"
          style={status.style}
          onChange={(style) => setRegionStyle(COMPACT_STATUS_ID, style)}
          supportsMesh={false}
        />
      ) : null}
    </div>
  );
}

export function CardPropertiesPanel({
  cardTemplateId,
  elements,
  onElementsChange,
}: CardPropertiesPanelProps) {
  if (isProfileFeatureCard(cardTemplateId)) {
    return <ProfileCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (cardTemplateId === "compact-horizontal") {
    return <CompactHorizontalCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  return null;
}
