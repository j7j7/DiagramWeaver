import type { DiagramNodeData } from "@/lib/types";
import type { CardElementData } from "@/lib/card-types";
import { isCardNodeType } from "@/lib/card-utils";
import {
  AGENDA_ADD_ROW_LABEL_ID,
  AGENDA_HEADER_ENTRIES_DIVIDER_ID,
  isAgendaAddRowId,
  isAgendaCard,
  isAgendaDividerElement,
} from "@/lib/card-agenda";
import {
  BULLET_LIST_ADD_ROW_LABEL_ID,
  isBulletListAddRowId,
  isBulletListCard,
} from "@/lib/card-bullet-list";
import {
  isProfileDiagonalSplitCard,
  PROFILE_DIAGONAL_SPLIT_LINE_ID,
} from "@/lib/card-profile-diagonal-split";
import { getPlainTextFromRuns, labelToRuns } from "@/lib/rich-text";

/** Depth-first list of animatable card regions (excludes root section shell). */
export function flattenCardElements(root: CardElementData | undefined): CardElementData[] {
  if (!root) return [];
  const out: CardElementData[] = [];
  const walk = (el: CardElementData, depth: number) => {
    if (el.kind !== "section" || depth > 0) {
      out.push(el);
    }
    for (const child of el.children ?? []) walk(child, depth + 1);
  };
  walk(root, 0);
  return out;
}

export function cardElementCount(node: DiagramNodeData): number {
  if (!isCardNodeType(node.type)) return 0;
  return flattenCardElements(node.card?.elements).length;
}

/** Matches `CardShape` / `CardElementRenderer` omit paths for slide stagger + shell timing. */
export interface CardSlideStaggerTimingOptions {
  templateId?: string;
  agendaDividersEnabled: boolean;
  isReadOnly: boolean;
  cardNodeSelected: boolean;
}

function emptyTagContent(el: CardElementData): boolean {
  const runs = labelToRuns(el.tag ?? "");
  return getPlainTextFromRuns(runs).trim().length === 0;
}

function emptyNonFillTextContent(el: CardElementData): boolean {
  const runs = el.richText ?? labelToRuns(el.text ?? "");
  return getPlainTextFromRuns(runs).trim().length === 0;
}

/** True ⇒ node is never mounted for slide animations (holes in DFS flat list inflate shell delay/cascade). */
export function shouldExcludeFromCardSlidePopTiming(
  el: CardElementData,
  opts: CardSlideStaggerTimingOptions,
): boolean {
  const tid = opts.templateId;
  if (tid && isAgendaCard(tid)) {
    if (el.id === AGENDA_HEADER_ENTRIES_DIVIDER_ID) return true;
    if (isAgendaDividerElement(el.id) && !opts.agendaDividersEnabled) return true;
    const hideAddRow = opts.isReadOnly || !opts.cardNodeSelected;
    if (hideAddRow && isAgendaAddRowId(el.id)) return true;
    if (hideAddRow && el.id === AGENDA_ADD_ROW_LABEL_ID) return true;
  }

  if (tid && isBulletListCard(tid)) {
    const hideAddRow = opts.isReadOnly || !opts.cardNodeSelected;
    if (hideAddRow && isBulletListAddRowId(el.id)) return true;
    if (hideAddRow && el.id === BULLET_LIST_ADD_ROW_LABEL_ID) return true;
  }

  if (tid && isProfileDiagonalSplitCard(tid) && el.id === PROFILE_DIAGONAL_SPLIT_LINE_ID) return true;

  /** Match `CardShape` “return null” when not editing; only safe to drop from indices in read-only / playback. */
  if (opts.isReadOnly) {
    if (el.kind === "tag" && emptyTagContent(el)) return true;
    if (el.kind === "text" && !el.layout?.fillRemaining && emptyNonFillTextContent(el)) return true;
  }

  return false;
}

/**
 * DFS order that participates in stagger pop — build {@link staggerMap} **only** from this list so indices
 * are contiguous 0…n‑1 and shell fade aligns with the last triggered segment.
 */
export function flattenCardElementsForSlideStaggerTiming(
  root: CardElementData | undefined,
  opts: CardSlideStaggerTimingOptions,
): CardElementData[] {
  return flattenCardElements(root).filter((el) => !shouldExcludeFromCardSlidePopTiming(el, opts));
}

/**
 * Stagger segment index for the card shell exit opacity pop — must match ordering used to build
 * {@link flattenCardElementsForSlideStaggerTiming} / `staggerMap`.
 *
 * For agenda templates, DFS order can leave thin horizontal/vertical divider sections at the tail
 * (or after omitted empty cells in read‑only playback). Waiting for those waves delays outer shell /
 * background fading after the viewer perceives content has already cascaded (~one extra cascade
 * step per divider; compounding stagger can reach ~slide budget gaps).
 */
export function cardShellExitStaggerSegmentIndex(
  timingParticipants: readonly CardElementData[],
  templateId: string | undefined,
): number {
  const n = timingParticipants.length;
  if (n <= 1) return 0;

  if (templateId && isAgendaCard(templateId)) {
    for (let i = n - 1; i >= 0; i--) {
      const el = timingParticipants[i]!;
      if (!isAgendaDividerElement(el.id)) return i;
    }
  }

  return n - 1;
}

/** Slide budget / tail: viewer-style playback (add-row omitted; matches stagger map cardinality). */
export function cardSlideStaggerParticipantCount(node: DiagramNodeData): number {
  if (!isCardNodeType(node.type) || !node.card) return 0;
  return flattenCardElementsForSlideStaggerTiming(node.card.elements, {
    templateId: node.card.templateId,
    agendaDividersEnabled: node.agendaDividersEnabled !== false,
    isReadOnly: true,
    cardNodeSelected: false,
  }).length;
}

export function cardPresentationSignature(node: DiagramNodeData): string | null {
  if (!isCardNodeType(node.type) || !node.card) return null;
  return JSON.stringify({
    templateId: node.card.templateId,
    elements: node.card.elements,
  });
}
