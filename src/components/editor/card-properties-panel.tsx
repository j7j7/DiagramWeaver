"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ColorPicker } from "@/components/ui/color-picker";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CardElementData, CardElementStyle, CardIconPlacement } from "@/lib/card-types";
import { CARD_ICON_PLACEMENTS } from "@/lib/card-icon-layout";
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
  parseListItemIndicatorCircle,
  applyListItemIndicatorCircle,
  parseListItemDragHandleEnabled,
  applyListItemDragHandleEnabled,
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
  getSidebarAccentRegions,
  parseSidebarAccentBarWidth,
  applySidebarAccentBarWidth,
  applySidebarAccentHeadingColor,
  updateSidebarAccentElementStyle,
  SIDEBAR_ACCENT_BODY_ID,
  SIDEBAR_ACCENT_COLOR_DEFAULT,
  SIDEBAR_ACCENT_BAR_WIDTH_MIN,
  SIDEBAR_ACCENT_BAR_WIDTH_MAX,
  isSidebarAccentCard,
} from "@/lib/card-sidebar-accent";
import {
  applyFramedHeadingAlign,
  applyFramedHeadingEdge,
  applyFramedHeadingTabWidthPct,
  applyFramedHeadingTextAlign,
  FRAMED_HEADING_TAB_WIDTH_MAX,
  FRAMED_HEADING_TAB_WIDTH_MIN,
  getFramedHeadingAlign,
  getFramedHeadingEdge,
  getFramedHeadingRegions,
  getFramedHeadingTextAlign,
  isFramedHeadingCard,
  parseFramedHeadingTabWidthPct,
  type FramedHeadingAlign,
  type FramedHeadingEdge,
  type FramedHeadingTextAlign,
} from "@/lib/card-framed-heading";
import {
  applyElementFeatureAccentColor,
  applyElementFeatureAccentLineHeight,
  applyElementFeatureAccentLineWidth,
  applyElementFeatureWatermarkFontSize,
  applyElementFeatureWatermarkText,
  ELEMENT_FEATURE_ACCENT_DEFAULT,
  ELEMENT_FEATURE_ACCENT_LINE_HEIGHT_MAX,
  ELEMENT_FEATURE_ACCENT_LINE_HEIGHT_MIN,
  ELEMENT_FEATURE_ACCENT_LINE_WIDTH_MAX,
  ELEMENT_FEATURE_ACCENT_LINE_WIDTH_MIN,
  ELEMENT_FEATURE_NUMBER_FONT_MAX,
  ELEMENT_FEATURE_NUMBER_FONT_MIN,
  getElementFeatureRegions,
  isElementFeatureCard,
  parseElementFeatureAccentLineHeight,
  parseElementFeatureAccentLineWidthPct,
  parseElementFeatureWatermarkFontSize,
  resolveElementFeatureAccentColor,
  updateElementFeatureElementStyle,
} from "@/lib/card-element-feature";
import {
  getProfileDiagonalSplitRegions,
  parseDiagonalSplitStartPct,
  parseDiagonalSplitEndPct,
  parseDiagonalSplitCurvePct,
  applyDiagonalSplitStartPct,
  applyDiagonalSplitEndPct,
  applyDiagonalSplitCurvePct,
  parseProfileDiagonalAvatarSize,
  applyProfileDiagonalAvatarSize,
  updateProfileDiagonalElementStyle,
  PROFILE_DIAGONAL_AVATAR_ID,
  isProfileDiagonalSplitCard,
  DIAGONAL_SPLIT_START_MIN,
  DIAGONAL_SPLIT_START_MAX,
  DIAGONAL_SPLIT_END_MIN,
  DIAGONAL_SPLIT_END_MAX,
  DIAGONAL_SPLIT_CURVE_MIN,
  DIAGONAL_SPLIT_CURVE_MAX,
} from "@/lib/card-profile-diagonal-split";
import {
  applyDashboardDecorIconOpacity,
  applyDashboardDecorSize,
  DECOR_OPACITY_MAX,
  DECOR_OPACITY_MIN,
  getDashboardStatRegions,
  METRIC_SUBTITLE_ID,
  METRIC_TITLE_ID,
  METRIC_VALUE_ID,
  parseDashboardDecorHeightPct,
  parseDashboardDecorIconOpacity,
  parseDashboardDecorWidthPct,
  updateDashboardElementStyle,
  isDashboardStatCard,
} from "@/lib/card-dashboard-stat";
import {
  addAgendaRow,
  AGENDA_DATE_HEADER_ID,
  AGENDA_SESSION_HEADER_ID,
  AGENDA_TABLE_HEADER_ID,
  AGENDA_TIME_HEADER_ID,
  applyAgendaRowFillStyle,
  applyAgendaDividerColor,
  AGENDA_DIVIDER_COLOR_DEFAULT,
  getAgendaDividerColor,
  getAgendaRegions,
  getAgendaRows,
  isAgendaCard,
  parseAgendaRow,
  removeAgendaRow,
  setAgendaColumnAlign,
  setAgendaRowHighlight,
  updateAgendaElementStyle,
} from "@/lib/card-agenda";
import {
  addBulletListRow,
  applyBulletListAccentColor,
  applyBulletListBulletShape,
  applyBulletListBulletSize,
  applyBulletListItemTextColor,
  applyBulletListTitleTextColor,
  applyBulletListTitleAlign,
  applyBulletListUseItemIcons,
  bulletListUseItemIconsEnabled,
  BULLET_LIST_ITEM_TEXT_DEFAULT,
  BULLET_LIST_CUBE_SUFFIX,
  BULLET_SIZE_MAX,
  BULLET_SIZE_MIN,
  getBulletListAccentColor,
  getBulletListItemTextColor,
  getBulletListTitleTextColor,
  getBulletListRows,
  getBulletListTitleAlign,
  isBulletListCard,
  parseBulletListRow,
  parseBulletListBulletShape,
  parseBulletListBulletSize,
  removeBulletListRow,
  type BulletListTitleAlign,
} from "@/lib/card-bullet-list";
import { useThemeMenuHueStepDeg } from "@/hooks/use-theme-menu-hue-step-deg";
import { useThemeMultiHueLayout } from "@/hooks/use-theme-multi-hue-layout";
import type { CardFlexJustify } from "@/lib/card-types";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { CardFillStyleControls } from "./card-fill-style-controls";

export interface CardPropertiesPanelProps {
  cardTemplateId?: string;
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
  agendaRowThemeHue?: boolean;
  onAgendaRowThemeHueChange?: (enabled: boolean) => void;
  agendaDividersEnabled?: boolean;
  onAgendaDividersEnabledChange?: (enabled: boolean) => void;
  bulletListItemThemeHue?: boolean;
  onBulletListItemThemeHueChange?: (enabled: boolean) => void;
  bulletListUseItemIcons?: boolean;
  onBulletListUseItemIconsChange?: (enabled: boolean) => void;
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

function ProfileDiagonalSplitCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { hero, title, subtitle, avatar } = getProfileDiagonalSplitRegions(elements);
  const splitStartPct = parseDiagonalSplitStartPct(hero);
  const splitEndPct = parseDiagonalSplitEndPct(hero);
  const splitCurvePct = parseDiagonalSplitCurvePct(hero);
  const avatarSize = parseProfileDiagonalAvatarSize(avatar);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateProfileDiagonalElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Diagonal split profile card — curved accent panel top-right, avatar, centered title and
        subtitle. Use <span className="font-medium">Background</span> above for the lower-left body
        fill.
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Split start (left edge)</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{Math.round(splitStartPct)}%</span>
        </div>
        <Slider
          min={DIAGONAL_SPLIT_START_MIN}
          max={DIAGONAL_SPLIT_START_MAX}
          step={1}
          value={[Math.round(splitStartPct)]}
          onValueChange={([v]) => onElementsChange(applyDiagonalSplitStartPct(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Split end (bottom edge)</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{Math.round(splitEndPct)}%</span>
        </div>
        <Slider
          min={DIAGONAL_SPLIT_END_MIN}
          max={DIAGONAL_SPLIT_END_MAX}
          step={1}
          value={[Math.round(splitEndPct)]}
          onValueChange={([v]) => onElementsChange(applyDiagonalSplitEndPct(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Split curve</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{Math.round(splitCurvePct)}%</span>
        </div>
        <Slider
          min={DIAGONAL_SPLIT_CURVE_MIN}
          max={DIAGONAL_SPLIT_CURVE_MAX}
          step={1}
          value={[Math.round(splitCurvePct)]}
          onValueChange={([v]) => onElementsChange(applyDiagonalSplitCurvePct(elements, v))}
          className="w-full"
        />
      </div>

      {hero ? (
        <CardFillStyleControls
          label="Accent fill"
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
              updateCardElementTree(elements, PROFILE_DIAGONAL_AVATAR_ID, { matchCardBorder: checked }),
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
              updateCardElementTree(elements, PROFILE_DIAGONAL_AVATAR_ID, { iconSlotShadow: checked }),
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
          min={32}
          max={72}
          step={1}
          value={[avatarSize]}
          onValueChange={([v]) => onElementsChange(applyProfileDiagonalAvatarSize(elements, v))}
          className="w-full"
        />
      </div>

      {avatar ? (
        <CardFillStyleControls
          label="Avatar fill"
          style={avatar.style}
          onChange={(style) => setRegionStyle(PROFILE_DIAGONAL_AVATAR_ID, style)}
        />
      ) : null}

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Icon position (in slot)</Label>
        <Select
          value={avatar?.iconPlacement ?? "center"}
          onValueChange={(value) =>
            onElementsChange(
              updateCardElementTree(elements, PROFILE_DIAGONAL_AVATAR_ID, {
                iconPlacement: value as CardIconPlacement,
              }),
            )
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Center" />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {CARD_ICON_PLACEMENTS.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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
  const indicatorCircle = parseListItemIndicatorCircle(indicator);
  const dragHandleEnabled = parseListItemDragHandleEnabled(elements);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateListItemElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        List item row — indicator on the left, label in the middle, drag handle on the right. Use{" "}
        <span className="font-medium">Background</span> above for the row fill. Drop an icon onto the
        indicator on the canvas.
      </p>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Drag handle</Label>
        <Switch
          checked={dragHandleEnabled}
          onCheckedChange={(checked) =>
            onElementsChange(applyListItemDragHandleEnabled(elements, checked))
          }
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Circle indicator</Label>
        <Switch
          checked={indicatorCircle}
          onCheckedChange={(checked) =>
            onElementsChange(applyListItemIndicatorCircle(elements, checked))
          }
        />
      </div>

      {indicatorCircle ? (
        <>
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
        </>
      ) : null}

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

      {indicatorCircle && indicator ? (
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

const FRAMED_HEADING_EDGE_OPTIONS: { value: FramedHeadingEdge; label: string }[] = [
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
];

const FRAMED_HEADING_ALIGN_OPTIONS: { value: FramedHeadingAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const FRAMED_HEADING_TEXT_ALIGN_OPTIONS: { value: FramedHeadingTextAlign; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

function FramedHeadingCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { headingTab, heading } = getFramedHeadingRegions(elements);
  const edge = getFramedHeadingEdge(headingTab);
  const align = getFramedHeadingAlign(headingTab);
  const textAlign = getFramedHeadingTextAlign(heading);
  const tabWidthPct = parseFramedHeadingTabWidthPct(headingTab);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Rounded border frame with a heading tab on the top or bottom edge. Use Visual styling{" "}
        <span className="font-medium">Background</span> for the frame interior,{" "}
        <span className="font-medium">Border</span> for the outer outline, and{" "}
        <span className="font-medium">Heading</span> for tab fill and border. Resize the card to
        scale the frame border; tab padding stays proportional while the tab grows for longer text.
      </p>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Heading edge</Label>
        <Select
          value={edge}
          onValueChange={(value) =>
            onElementsChange(applyFramedHeadingEdge(elements, value as FramedHeadingEdge))
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {FRAMED_HEADING_EDGE_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Heading position</Label>
        <Select
          value={align}
          onValueChange={(value) =>
            onElementsChange(applyFramedHeadingAlign(elements, value as FramedHeadingAlign))
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {FRAMED_HEADING_ALIGN_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Heading box width</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{tabWidthPct}%</span>
        </div>
        <Slider
          min={FRAMED_HEADING_TAB_WIDTH_MIN}
          max={FRAMED_HEADING_TAB_WIDTH_MAX}
          step={1}
          value={[tabWidthPct]}
          onValueChange={([v]) => onElementsChange(applyFramedHeadingTabWidthPct(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Text alignment</Label>
        <Select
          value={textAlign}
          onValueChange={(value) =>
            onElementsChange(applyFramedHeadingTextAlign(elements, value as FramedHeadingTextAlign))
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {FRAMED_HEADING_TEXT_ALIGN_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function SidebarAccentCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { accentBar, heading, body } = getSidebarAccentRegions(elements);
  const barWidth = parseSidebarAccentBarWidth(accentBar);
  const accentColor = heading?.textColor ?? SIDEBAR_ACCENT_COLOR_DEFAULT;

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateSidebarAccentElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Sidebar accent card — pill accent on the left matches the heading color. Use{" "}
        <span className="font-medium">Background</span> above for the card fill and{" "}
        <span className="font-medium">Border</span> for the outline.
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Sidebar thickness</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{barWidth}px</span>
        </div>
        <Slider
          min={SIDEBAR_ACCENT_BAR_WIDTH_MIN}
          max={SIDEBAR_ACCENT_BAR_WIDTH_MAX}
          step={1}
          value={[barWidth]}
          onValueChange={([v]) => onElementsChange(applySidebarAccentBarWidth(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Heading &amp; sidebar color</Label>
        <ColorPicker
          value={accentColor}
          onChange={(value) => onElementsChange(applySidebarAccentHeadingColor(elements, value))}
        />
      </div>

      {body ? (
        <CardFillStyleControls
          label="Body text segment"
          style={body.style}
          onChange={(style) => setRegionStyle(SIDEBAR_ACCENT_BODY_ID, style)}
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
  const { title, subtitle, value, decor } = getDashboardStatRegions(elements);
  const decorWidthPct = parseDashboardDecorWidthPct(decor);
  const decorHeightPct = parseDashboardDecorHeightPct(decor);
  const decorOpacity = parseDashboardDecorIconOpacity(decor);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateDashboardElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Dashboard stat card — gradient fill, title and value text, action icon (placement and size via{" "}
        <span className="font-medium">Icon styling</span>), decorative watermark icon bottom-right
        (drop onto the bottom-right corner of the card). Use{" "}
        <span className="font-medium">Background</span> above for the card gradient.
      </p>

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

function AgendaCardProperties({
  elements,
  onElementsChange,
  agendaRowThemeHue,
  onAgendaRowThemeHueChange,
  agendaDividersEnabled = true,
  onAgendaDividersEnabledChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
  agendaRowThemeHue?: boolean;
  onAgendaRowThemeHueChange?: (enabled: boolean) => void;
  agendaDividersEnabled?: boolean;
  onAgendaDividersEnabledChange?: (enabled: boolean) => void;
}) {
  const { dateHeader, tableHeader } = getAgendaRegions(elements);
  const rows = getAgendaRows(elements).map(parseAgendaRow);
  const timeHeader = tableHeader?.children?.find((c) => c.id === AGENDA_TIME_HEADER_ID);
  const sessionHeader = tableHeader?.children?.find((c) => c.id === AGENDA_SESSION_HEADER_ID);
  const timeAlign = timeHeader?.layout?.justifyContent ?? "start";
  const sessionAlign = sessionHeader?.layout?.justifyContent ?? "start";
  const globalMultiHue = useThemeMultiHueLayout();
  const hueStepDeg = useThemeMenuHueStepDeg();
  const rowFillStyle = getAgendaRows(elements)[0]?.style;
  const dividerColor = getAgendaDividerColor(elements);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateAgendaElementStyle(elements, elementId, style));
  };

  const alignOptions: { value: CardFlexJustify; label: string }[] = [
    { value: "start", label: "Left" },
    { value: "center", label: "Center" },
    { value: "end", label: "Right" },
  ];

  const themeHueOn = agendaRowThemeHue ?? globalMultiHue;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Agenda — date band, dark column headers (auto-inverts in dark UI), and schedule rows. Click{" "}
        <span className="font-medium">+ Add item</span> on the card or use the list below. Card shell
        fill is under <span className="font-medium">Background</span> above.
      </p>

      {dateHeader ? (
        <CardFillStyleControls
          label="Date / title band"
          style={dateHeader.style}
          onChange={(style) => setRegionStyle(AGENDA_DATE_HEADER_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {tableHeader ? (
        <CardFillStyleControls
          label="Time / Session header band"
          style={tableHeader.style}
          onChange={(style) => setRegionStyle(AGENDA_TABLE_HEADER_ID, style)}
          supportsMesh={false}
        />
      ) : null}

      {rowFillStyle ? (
        <CardFillStyleControls
          label="Row fill (all lines)"
          style={rowFillStyle}
          onChange={(style) => onElementsChange(applyAgendaRowFillStyle(elements, style))}
          supportsMesh={false}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Divider lines</Label>
        <Switch
          checked={agendaDividersEnabled}
          onCheckedChange={(checked) => onAgendaDividersEnabledChange?.(checked)}
        />
      </div>
      {agendaDividersEnabled ? (
        <div className="space-y-1">
          <Label className="text-sm text-muted-foreground">Divider color</Label>
          <ColorPicker
            value={dividerColor || AGENDA_DIVIDER_COLOR_DEFAULT}
            onChange={(value) => onElementsChange(applyAgendaDividerColor(elements, value))}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Step hue per row</Label>
        <Switch
          checked={themeHueOn}
          onCheckedChange={(checked) => onAgendaRowThemeHueChange?.(checked)}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        When on, each row shifts hue by {hueStepDeg}° (Themes → Step hue for multi-selection). When off,
        every row uses the same fill. Defaults to that Themes checkbox when unset.
      </p>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Time column align</Label>
        <Select
          value={timeAlign}
          onValueChange={(value) =>
            onElementsChange(setAgendaColumnAlign(elements, "time", value as CardFlexJustify))
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {alignOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Session column align</Label>
        <Select
          value={sessionAlign}
          onValueChange={(value) =>
            onElementsChange(setAgendaColumnAlign(elements, "session", value as CardFlexJustify))
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {alignOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Schedule rows</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() =>
              onElementsChange(
                addAgendaRow(elements, { themeHue: themeHueOn, hueStepDeg }),
              )
            }
          >
            <Plus className="h-3.5 w-3.5" />
            Add row
          </Button>
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border/60 p-1">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate tabular-nums text-muted-foreground">
                {row.time || "—"}
              </span>
              <span className="min-w-0 flex-[2] truncate">{row.session || "Untitled"}</span>
              <Switch
                checked={!!row.highlighted}
                onCheckedChange={(checked) =>
                  onElementsChange(setAgendaRowHighlight(elements, row.id, checked))
                }
                aria-label={`Highlight ${row.session}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0"
                disabled={rows.length <= 1}
                onClick={() => onElementsChange(removeAgendaRow(elements, row.id))}
              >
                <Minus className="h-3.5 w-3.5" />
                <span className="sr-only">Remove row</span>
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Toggle highlight per row; remove with minus (at least one row required).
        </p>
      </div>
    </div>
  );
}

function BulletListCardProperties({
  elements,
  onElementsChange,
  bulletListItemThemeHue,
  onBulletListItemThemeHueChange,
  bulletListUseItemIcons,
  onBulletListUseItemIconsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
  bulletListItemThemeHue?: boolean;
  onBulletListItemThemeHueChange?: (enabled: boolean) => void;
  bulletListUseItemIcons?: boolean;
  onBulletListUseItemIconsChange?: (enabled: boolean) => void;
}) {
  const rows = getBulletListRows(elements).map(parseBulletListRow);
  const globalMultiHue = useThemeMultiHueLayout();
  const hueStepDeg = useThemeMenuHueStepDeg();
  const accentColor = getBulletListAccentColor(elements);
  const titleTextColor = getBulletListTitleTextColor(elements);
  const itemTextColor = getBulletListItemTextColor(elements);
  const themeHueOn = bulletListItemThemeHue ?? globalMultiHue;
  const useItemIcons = bulletListUseItemIconsEnabled(bulletListUseItemIcons, elements);
  const firstMarker = getBulletListRows(elements)[0]?.children?.find((c) =>
    c.id.endsWith(BULLET_LIST_CUBE_SUFFIX),
  );
  const bulletSize = parseBulletListBulletSize(firstMarker);
  const bulletCircle = parseBulletListBulletShape(firstMarker) === "circle";
  const titleAlign = getBulletListTitleAlign(elements);
  const titleAlignOptions: { value: BulletListTitleAlign; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "center", label: "Center" },
    { value: "right", label: "Right" },
    { value: "full", label: "Aligned" },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Bullet list — title, bullets, and editable items that stretch to fill the card height. Click{" "}
        <span className="font-medium">+ Add item</span> on the card or use the list below. Card shell
        fill is under <span className="font-medium">Background</span> above.
      </p>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Title align</Label>
        <Select
          value={titleAlign}
          onValueChange={(value) =>
            onElementsChange(applyBulletListTitleAlign(elements, value as BulletListTitleAlign))
          }
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-[70]">
            {titleAlignOptions.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-sm">
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm text-muted-foreground">Item icons</Label>
        <Switch
          checked={useItemIcons}
          onCheckedChange={(checked) => {
            onBulletListUseItemIconsChange?.(checked);
            onElementsChange(applyBulletListUseItemIcons(elements, checked));
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        When on, drag icons from the resources sidebar onto each row marker. Select a marker on the
        card to set icon color, opacity, and background in Visual styling.
      </p>

      {!useItemIcons ? (
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Circle bullet</Label>
          <Switch
            checked={bulletCircle}
            onCheckedChange={(checked) =>
              onElementsChange(applyBulletListBulletShape(elements, checked ? "circle" : "square"))
            }
          />
        </div>
      ) : null}

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">
            {useItemIcons ? "Icon size" : "Bullet size"}
          </Label>
          <span className="tabular-nums text-xs text-muted-foreground">{bulletSize}px</span>
        </div>
        <Slider
          min={BULLET_SIZE_MIN}
          max={BULLET_SIZE_MAX}
          step={1}
          value={[bulletSize]}
          onValueChange={([v]) => onElementsChange(applyBulletListBulletSize(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Heading text color</Label>
        <ColorPicker
          value={titleTextColor}
          onChange={(value) => onElementsChange(applyBulletListTitleTextColor(elements, value))}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Item text color</Label>
        <ColorPicker
          value={itemTextColor || BULLET_LIST_ITEM_TEXT_DEFAULT}
          onChange={(value) => onElementsChange(applyBulletListItemTextColor(elements, value))}
        />
      </div>

      {!useItemIcons ? (
        <div className="space-y-1">
          <Label className="text-sm text-muted-foreground">Accent color (bullets, + Add item)</Label>
          <ColorPicker
            value={accentColor}
            onChange={(value) => onElementsChange(applyBulletListAccentColor(elements, value))}
          />
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-sm text-muted-foreground">+ Add item color</Label>
          <ColorPicker
            value={accentColor}
            onChange={(value) => onElementsChange(applyBulletListAccentColor(elements, value))}
          />
        </div>
      )}

      {!useItemIcons ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-sm text-muted-foreground">Step hue per bullet</Label>
            <Switch
              checked={themeHueOn}
              onCheckedChange={(checked) => onBulletListItemThemeHueChange?.(checked)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            When off, every cube matches the accent color. When on, each bullet shifts hue from the
            first (uses Themes menu hue step).
          </p>
        </>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Items</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={() =>
              onElementsChange(
                addBulletListRow(elements, { themeHue: themeHueOn, hueStepDeg }),
              )
            }
          >
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 truncate">{row.text || "Empty item"}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0"
                disabled={rows.length <= 1}
                onClick={() => onElementsChange(removeBulletListRow(elements, row.id))}
              >
                <Minus className="h-3.5 w-3.5" />
                <span className="sr-only">Remove item</span>
              </Button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Drag rows on the card to reorder; remove with minus (at least one item required).
        </p>
      </div>
    </div>
  );
}

function ElementFeatureCardProperties({
  elements,
  onElementsChange,
}: {
  elements: CardElementData;
  onElementsChange: (elements: CardElementData) => void;
}) {
  const { label, watermark, accentLine } = getElementFeatureRegions(elements);
  const watermarkFontSize = parseElementFeatureWatermarkFontSize(watermark);
  const watermarkText = watermark?.text ?? "";
  const accentLineWidthPct = parseElementFeatureAccentLineWidthPct(accentLine);
  const accentLineHeight = parseElementFeatureAccentLineHeight(accentLine);
  const accentColor = resolveElementFeatureAccentColor(elements, undefined, ELEMENT_FEATURE_ACCENT_DEFAULT);

  const setRegionStyle = (elementId: string, style: CardElementStyle) => {
    onElementsChange(updateElementFeatureElementStyle(elements, elementId, style));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Element feature slide — dark mesh background, glowing subtitle, large watermark text, and a
        gradient accent line that fades to transparent. The default example uses{" "}
        <span className="font-medium">03</span>; replace it with any label, word, or number. Use{" "}
        <span className="font-medium">Background</span> above for the card fill (mesh gradient
        recommended) and <span className="font-medium">Border</span> for the outline.
      </p>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Accent color</Label>
        <ColorPicker
          value={accentColor}
          onChange={(value) => onElementsChange(applyElementFeatureAccentColor(elements, value))}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-sm text-muted-foreground">Watermark text</Label>
        <Input
          value={watermarkText}
          onChange={(e) =>
            onElementsChange(applyElementFeatureWatermarkText(elements, e.target.value))
          }
          placeholder="03"
          className="h-9 text-sm"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Watermark text size</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{watermarkFontSize}px</span>
        </div>
        <Slider
          min={ELEMENT_FEATURE_NUMBER_FONT_MIN}
          max={ELEMENT_FEATURE_NUMBER_FONT_MAX}
          step={2}
          value={[watermarkFontSize]}
          onValueChange={([v]) => onElementsChange(applyElementFeatureWatermarkFontSize(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Accent line width</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{accentLineWidthPct}%</span>
        </div>
        <Slider
          min={ELEMENT_FEATURE_ACCENT_LINE_WIDTH_MIN}
          max={ELEMENT_FEATURE_ACCENT_LINE_WIDTH_MAX}
          step={1}
          value={[accentLineWidthPct]}
          onValueChange={([v]) => onElementsChange(applyElementFeatureAccentLineWidth(elements, v))}
          className="w-full"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm text-muted-foreground">Accent line thickness</Label>
          <span className="tabular-nums text-xs text-muted-foreground">{accentLineHeight}px</span>
        </div>
        <Slider
          min={ELEMENT_FEATURE_ACCENT_LINE_HEIGHT_MIN}
          max={ELEMENT_FEATURE_ACCENT_LINE_HEIGHT_MAX}
          step={1}
          value={[accentLineHeight]}
          onValueChange={([v]) => onElementsChange(applyElementFeatureAccentLineHeight(elements, v))}
          className="w-full"
        />
      </div>

      {accentLine ? (
        <CardFillStyleControls
          label="Accent line fill"
          style={accentLine.style}
          onChange={(style) => setRegionStyle("accent-line", style)}
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
  agendaRowThemeHue,
  onAgendaRowThemeHueChange,
  agendaDividersEnabled,
  onAgendaDividersEnabledChange,
  bulletListItemThemeHue,
  onBulletListItemThemeHueChange,
  bulletListUseItemIcons,
  onBulletListUseItemIconsChange,
}: CardPropertiesPanelProps) {
  if (isProfileFeatureCard(cardTemplateId)) {
    return <ProfileCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isProfileSocialCard(cardTemplateId)) {
    return <ProfileSocialCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isProfileDiagonalSplitCard(cardTemplateId)) {
    return <ProfileDiagonalSplitCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (cardTemplateId === "compact-horizontal") {
    return <CompactHorizontalCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isListItemRowCard(cardTemplateId)) {
    return <ListItemRowCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isFramedHeadingCard(cardTemplateId)) {
    return <FramedHeadingCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isSidebarAccentCard(cardTemplateId)) {
    return <SidebarAccentCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isElementFeatureCard(cardTemplateId)) {
    return <ElementFeatureCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isDetailPostCard(cardTemplateId)) {
    return <DetailPostCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isDashboardStatCard(cardTemplateId)) {
    return <DashboardStatCardProperties elements={elements} onElementsChange={onElementsChange} />;
  }
  if (isAgendaCard(cardTemplateId)) {
    return (
      <AgendaCardProperties
        elements={elements}
        onElementsChange={onElementsChange}
        agendaRowThemeHue={agendaRowThemeHue}
        onAgendaRowThemeHueChange={onAgendaRowThemeHueChange}
        agendaDividersEnabled={agendaDividersEnabled}
        onAgendaDividersEnabledChange={onAgendaDividersEnabledChange}
      />
    );
  }
  if (isBulletListCard(cardTemplateId)) {
    return (
      <BulletListCardProperties
        elements={elements}
        onElementsChange={onElementsChange}
        bulletListItemThemeHue={bulletListItemThemeHue}
        onBulletListItemThemeHueChange={onBulletListItemThemeHueChange}
        bulletListUseItemIcons={bulletListUseItemIcons}
        onBulletListUseItemIconsChange={onBulletListUseItemIconsChange}
      />
    );
  }
  return null;
}
