"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { CardElementData, CardElementStyle } from "@/lib/card-types";
import { updateCardElementTree } from "@/lib/card-utils";
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
  getProfileSocialRegions,
  parseProfileSocialAvatarSize,
  applyProfileSocialAvatarSize,
  updateProfileSocialElementStyle,
  PROFILE_SOCIAL_AVATAR_ID,
  PROFILE_SOCIAL_NAME_ID,
  PROFILE_SOCIAL_AGE_ID,
  PROFILE_SOCIAL_LOCATION_ID,
  PROFILE_SOCIAL_DESCRIPTION_ID,
  PROFILE_SOCIAL_DIVIDER_ID,
  isProfileSocialCard,
} from "@/lib/card-profile-social";
import {
  getCompactHorizontalRegions,
  parseCompactAvatarSize,
  applyCompactAvatarSize,
  updateCompactElementStyle,
  COMPACT_AVATAR_ID,
  COMPACT_NAME_ID,
  COMPACT_STATUS_ID,
} from "@/lib/card-compact-horizontal";
import {
  getListItemRowRegions,
  parseListItemIndicatorSize,
  applyListItemIndicatorSize,
  updateListItemElementStyle,
  LIST_ITEM_INDICATOR_ID,
  LIST_ITEM_LABEL_ID,
  isListItemRowCard,
} from "@/lib/card-list-item";
import {
  getDetailPostRegions,
  parseDetailPostHeaderIconSize,
  applyDetailPostHeaderIconSize,
  updateDetailPostElementStyle,
  DETAIL_POST_HEADER_ICON_ID,
  DETAIL_POST_HEADER_TAG_ID,
  DETAIL_POST_HEADLINE_ID,
  DETAIL_POST_BODY_LINE_1_ID,
  DETAIL_POST_BODY_LINE_2_ID,
  DETAIL_POST_FOOTER_ID,
  DETAIL_POST_CTA_ID,
  isDetailPostCard,
} from "@/lib/card-detail-post";
import {
  applyDashboardActionSize,
  applyDashboardDecorIconOpacity,
  applyDashboardDecorSize,
  DECOR_OPACITY_MAX,
  DECOR_OPACITY_MIN,
  getDashboardStatRegions,
  METRIC_ACTION_ID,
  METRIC_SUBTITLE_ID,
  METRIC_TITLE_ID,
  METRIC_VALUE_ID,
  parseDashboardActionSize,
  parseDashboardDecorHeightPct,
  parseDashboardDecorIconOpacity,
  parseDashboardDecorWidthPct,
  updateDashboardElementStyle,
  isDashboardStatCard,
} from "@/lib/card-dashboard-stat";
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

function ProfileSocialCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { hero, avatar, name, age, location, description, divider } = getProfileSocialRegions(elements);
  const heroPct = parseProfileHeroHeightPct(hero);
  const avatarSize = parseProfileSocialAvatarSize(avatar);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateProfileSocialElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Social profile layout — teal header, overlapping avatar, name, location, and stats. Use{" "}
        <span className="font-medium">Background</span> above for the card body fill. Drag the handle
        between the header and body on the canvas to resize the header strip.
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Header strip height</Label>
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
          label="Header fill"
          style={hero.style}
          onChange={(style) => setRegionStyle(PROFILE_HERO_ID, style)}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Avatar border (match card)</Label>
        <Switch
          checked={avatar?.matchCardBorder ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, PROFILE_SOCIAL_AVATAR_ID, { matchCardBorder: checked }),
            )
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Avatar shadow</Label>
        <Switch
          checked={avatar?.iconSlotShadow ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, PROFILE_SOCIAL_AVATAR_ID, { iconSlotShadow: checked }),
            )
          }
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Avatar size</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{avatarSize}px</span>
        </div>
        <Slider
          min={40}
          max={88}
          step={1}
          value={[avatarSize]}
          onValueChange={([v]) => onElementsChange(applyProfileSocialAvatarSize(elements, v))}
          className="w-full"
        />
      </div>

      {avatar ? (
        <CardFillStyleControls
          label="Avatar fill"
          style={avatar.style}
          onChange={(style) => setRegionStyle(PROFILE_SOCIAL_AVATAR_ID, style)}
        />
      ) : null}

      {name ? (
        <CardFillStyleControls
          label="Name segment"
          style={name.style}
          onChange={(style) => setRegionStyle(PROFILE_SOCIAL_NAME_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {age ? (
        <CardFillStyleControls
          label="Age segment"
          style={age.style}
          onChange={(style) => setRegionStyle(PROFILE_SOCIAL_AGE_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {location ? (
        <CardFillStyleControls
          label="Location segment"
          style={location.style}
          onChange={(style) => setRegionStyle(PROFILE_SOCIAL_LOCATION_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {description ? (
        <CardFillStyleControls
          label="Description segment"
          style={description.style}
          onChange={(style) => setRegionStyle(PROFILE_SOCIAL_DESCRIPTION_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {divider ? (
        <CardFillStyleControls
          label="Divider"
          style={divider.style}
          onChange={(style) => setRegionStyle(PROFILE_SOCIAL_DIVIDER_ID, style)}
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
        circle on the canvas; it fills the circle by default.
      </p>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Circle border (match card)</Label>
        <Switch
          checked={avatar?.matchCardBorder ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, COMPACT_AVATAR_ID, { matchCardBorder: checked }),
            )
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Circle shadow</Label>
        <Switch
          checked={avatar?.iconSlotShadow ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, COMPACT_AVATAR_ID, { iconSlotShadow: checked }),
            )
          }
        />
      </div>

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

function ListItemRowCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { indicator, label } = getListItemRowRegions(elements);
  const indicatorSize = parseListItemIndicatorSize(indicator);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateListItemElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        List item row — indicator on the left, label in the middle, drag handle on the right. Use{" "}
        <span className="font-medium">Background</span> above for the row fill. Drop an icon onto the
        circle on the canvas; it fills the circle by default.
      </p>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Circle border (match card)</Label>
        <Switch
          checked={indicator?.matchCardBorder ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, LIST_ITEM_INDICATOR_ID, { matchCardBorder: checked }),
            )
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Circle shadow</Label>
        <Switch
          checked={indicator?.iconSlotShadow ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, LIST_ITEM_INDICATOR_ID, { iconSlotShadow: checked }),
            )
          }
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Indicator size</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{indicatorSize}px</span>
        </div>
        <Slider
          min={12}
          max={40}
          step={1}
          value={[indicatorSize]}
          onValueChange={([v]) => onElementsChange(applyListItemIndicatorSize(elements, v))}
          className="w-full"
        />
      </div>

      {indicator ? (
        <CardFillStyleControls
          label="Indicator fill"
          style={indicator.style}
          onChange={(style) => setRegionStyle(LIST_ITEM_INDICATOR_ID, style)}
        />
      ) : null}

      {label ? (
        <CardFillStyleControls
          label="Label segment"
          style={label.style}
          onChange={(style) => setRegionStyle(LIST_ITEM_LABEL_ID, style)}
          supportsMesh={false}
        />
      ) : null}
    </div>
  );
}

function DetailPostCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { headerIcon, headerTag, headline, bodyLine1, bodyLine2, footer, cta } =
    getDetailPostRegions(elements);
  const iconSize = parseDetailPostHeaderIconSize(headerIcon);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateDetailPostElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Detail post layout — header icon and tag, headline and body lines, footer with call to action. Use{" "}
        <span className="font-medium">Background</span> above for the card fill and{" "}
        <span className="font-medium">Border</span> for the outline. Drop an icon onto the header slot on
        the canvas; it fills the slot by default.
      </p>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Icon border (match card)</Label>
        <Switch
          checked={headerIcon?.matchCardBorder ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, DETAIL_POST_HEADER_ICON_ID, { matchCardBorder: checked }),
            )
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Icon shadow</Label>
        <Switch
          checked={headerIcon?.iconSlotShadow ?? false}
          onCheckedChange={(checked) =>
            onElementsChange(
              updateCardElementTree(elements, DETAIL_POST_HEADER_ICON_ID, { iconSlotShadow: checked }),
            )
          }
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Header icon size</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{iconSize}px</span>
        </div>
        <Slider
          min={20}
          max={48}
          step={1}
          value={[iconSize]}
          onValueChange={([v]) => onElementsChange(applyDetailPostHeaderIconSize(elements, v))}
          className="w-full"
        />
      </div>

      {headerIcon ? (
        <CardFillStyleControls
          label="Header icon fill"
          style={headerIcon.style}
          onChange={(style) => setRegionStyle(DETAIL_POST_HEADER_ICON_ID, style)}
        />
      ) : null}

      {headerTag ? (
        <CardFillStyleControls
          label="Header tag fill"
          style={headerTag.style}
          onChange={(style) => setRegionStyle(DETAIL_POST_HEADER_TAG_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {headline ? (
        <CardFillStyleControls
          label="Headline segment"
          style={headline.style}
          onChange={(style) => setRegionStyle(DETAIL_POST_HEADLINE_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {bodyLine1 ? (
        <CardFillStyleControls
          label="Body line 1 segment"
          style={bodyLine1.style}
          onChange={(style) => setRegionStyle(DETAIL_POST_BODY_LINE_1_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {bodyLine2 ? (
        <CardFillStyleControls
          label="Body line 2 segment"
          style={bodyLine2.style}
          onChange={(style) => setRegionStyle(DETAIL_POST_BODY_LINE_2_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {footer ? (
        <CardFillStyleControls
          label="Footer fill"
          style={footer.style}
          onChange={(style) => setRegionStyle(DETAIL_POST_FOOTER_ID, style)}
        />
      ) : null}

      {cta ? (
        <CardFillStyleControls
          label="Call to action segment"
          style={cta.style}
          onChange={(style) => setRegionStyle(DETAIL_POST_CTA_ID, style)}
          supportsMesh={false}
        />
      ) : null}
    </div>
  );
}

function DashboardStatCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { title, subtitle, value, action, decor } = getDashboardStatRegions(elements);
  const actionSize = parseDashboardActionSize(action);
  const decorWidthPct = parseDashboardDecorWidthPct(decor);
  const decorHeightPct = parseDashboardDecorHeightPct(decor);
  const decorOpacity = parseDashboardDecorIconOpacity(decor);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateDashboardElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Dashboard stat card — gradient fill, title and value text, action icon top-right, decorative
        watermark icon bottom-right (drop onto the bottom-right corner of the card, not the small top
        circle). Use <span className="font-medium">Background</span> above for the card gradient.
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Action icon size</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{actionSize}px</span>
        </div>
        <Slider
          min={18}
          max={40}
          step={1}
          value={[actionSize]}
          onValueChange={([v]) => onElementsChange(applyDashboardActionSize(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Decor icon width</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{decorWidthPct}%</span>
        </div>
        <Slider
          min={35}
          max={80}
          step={1}
          value={[decorWidthPct]}
          onValueChange={([v]) =>
            onElementsChange(applyDashboardDecorSize(elements, v, decorHeightPct))
          }
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Decor icon height</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{decorHeightPct}%</span>
        </div>
        <Slider
          min={35}
          max={80}
          step={1}
          value={[decorHeightPct]}
          onValueChange={([v]) =>
            onElementsChange(applyDashboardDecorSize(elements, decorWidthPct, v))
          }
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Decor icon opacity</Label>
          <span className="tabular-nums text-xs text-muted-foreground">
            {Math.round(DECOR_OPACITY_MIN * decorOpacity * 100)}–
            {Math.round(DECOR_OPACITY_MAX * decorOpacity * 100)}%
          </span>
        </div>
        <Slider
          min={0}
          max={100}
          step={1}
          value={[Math.round(decorOpacity * 100)]}
          onValueChange={([v]) => onElementsChange(applyDashboardDecorIconOpacity(elements, v / 100))}
          className="w-full"
        />
      </div>

      {action ? (
        <CardFillStyleControls
          label="Action icon fill"
          style={action.style}
          onChange={(style) => setRegionStyle(METRIC_ACTION_ID, style)}
        />
      ) : null}

      {title ? (
        <CardFillStyleControls
          label="Title segment"
          style={title.style}
          onChange={(style) => setRegionStyle(METRIC_TITLE_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {subtitle ? (
        <CardFillStyleControls
          label="Subtitle segment"
          style={subtitle.style}
          onChange={(style) => setRegionStyle(METRIC_SUBTITLE_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {value ? (
        <CardFillStyleControls
          label="Value segment"
          style={value.style}
          onChange={(style) => setRegionStyle(METRIC_VALUE_ID, style)}
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
  if (isProfileSocialCard(cardTemplateId)) {
    return <ProfileSocialCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (cardTemplateId === "compact-horizontal") {
    return <CompactHorizontalCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isListItemRowCard(cardTemplateId)) {
    return <ListItemRowCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isDetailPostCard(cardTemplateId)) {
    return <DetailPostCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isDashboardStatCard(cardTemplateId)) {
    return <DashboardStatCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  return null;
}
