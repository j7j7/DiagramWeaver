"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Circle,
  MinusCircle,
  XCircle,
  Layers,
} from "lucide-react";

export type AvailabilityStatus = "green" | "amber" | "red";
export type SimulationElementState = "active" | "degraded" | "inactive";

export interface DependencyGroup {
  id: string;
  label: string;
  memberIds: string[];
  /** Minimum number of non-inactive members for this group to be considered "healthy" */
  minHealthy: number;
  /** Minimum number of non-inactive members for this group to be "degraded" (below = unavailable) */
  minDegraded: number;
}

interface CanvasElement {
  id: string;
  label: string;
  type: "node" | "zone" | "connection";
}

interface SimulationAvailabilityWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetLabel: string;
  targetStatus: AvailabilityStatus;
  targetState: SimulationElementState;
  dependencyGroups: DependencyGroup[];
  statusColors: Record<AvailabilityStatus, string>;
  statusTexts: Record<AvailabilityStatus, string>;
  statusShadowColors: Record<AvailabilityStatus, string>;
  stateColors: Record<SimulationElementState, string>;
  stateOpacity: number;
  dependencyOpacity: number;
  allCanvasElements: CanvasElement[];
  simulationItemStateById: Record<string, SimulationElementState>;
  onItemStateChange: (itemId: string, state: SimulationElementState) => void;
  onGroupsChange: (groups: DependencyGroup[]) => void;
  onStatusColorChange: (status: AvailabilityStatus, color: string) => void;
  onStatusTextChange: (status: AvailabilityStatus, text: string) => void;
  onStatusShadowColorChange: (status: AvailabilityStatus, color: string) => void;
  onStateColorChange: (state: SimulationElementState, color: string) => void;
  onStateOpacityChange: (opacity: number) => void;
  onDependencyOpacityChange: (opacity: number) => void;
}

function statusLabel(status: AvailabilityStatus): string {
  if (status === "green") return "Healthy";
  if (status === "amber") return "Degraded";
  return "Unavailable";
}

function elementStateLabel(state: SimulationElementState): string {
  if (state === "active") return "Active";
  if (state === "degraded") return "Degraded";
  return "Inactive";
}

function ElementStateIcon({ state, className }: { state: SimulationElementState; className?: string }) {
  if (state === "active") return <Circle className={cn("text-green-500 fill-green-500", className)} />;
  if (state === "degraded") return <MinusCircle className={cn("text-amber-500", className)} />;
  return <XCircle className={cn("text-red-500", className)} />;
}

function nextElementState(state: SimulationElementState): SimulationElementState {
  if (state === "active") return "degraded";
  if (state === "degraded") return "inactive";
  return "active";
}

/**
 * Resolve a threshold value to an effective member count.
 * - 0 → 0 (special: "never unavailable" for minDegraded)
 * - (0, 1) → Math.ceil(val * total) — fraction of members
 * - >= 1 → Math.round(val) clamped to [1, total]
 */
function resolveThreshold(val: number, total: number): number {
  if (val === 0) return 0;
  if (val > 0 && val < 1) return Math.min(total, Math.max(1, Math.ceil(val * total)));
  return Math.min(total, Math.max(1, Math.round(val)));
}

function computeGroupStatus(
  group: DependencyGroup,
  simulationItemStateById: Record<string, SimulationElementState>
): AvailabilityStatus {
  const total = group.memberIds.length;
  if (total === 0) return "green";
  const getState = (id: string): SimulationElementState => simulationItemStateById[id] ?? "active";
  const activeCount = group.memberIds.filter((id) => getState(id) !== "inactive").length;
  const healthyCount = group.memberIds.filter((id) => getState(id) === "active").length;
  const minH = resolveThreshold(group.minHealthy, total);
  // minDegraded=0 means the group can never be "red" (always at least degraded)
  const minD = group.minDegraded === 0 ? 0 : resolveThreshold(group.minDegraded, total);
  if (healthyCount >= minH) return "green";
  if (minD === 0 || activeCount >= minD) return "amber";
  return "red";
}

function GroupStatusBadge({ status }: { status: AvailabilityStatus }) {
  const colorClass =
    status === "green"
      ? "bg-green-100 text-green-800 border-green-300"
      : status === "amber"
        ? "bg-amber-100 text-amber-800 border-amber-300"
        : "bg-red-100 text-red-800 border-red-300";
  return (
    <span className={cn("rounded border px-1.5 py-0.5 text-xs font-medium", colorClass)}>
      {statusLabel(status)}
    </span>
  );
}

function generateGroupId(): string {
  return `group-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Member Picker component
function MemberPicker({
  currentMemberIds,
  allCanvasElements,
  simulationItemStateById,
  onAdd,
  onClose,
}: {
  currentMemberIds: string[];
  allCanvasElements: CanvasElement[];
  simulationItemStateById: Record<string, SimulationElementState>;
  onAdd: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return allCanvasElements.filter(
      (el) =>
        !currentMemberIds.includes(el.id) &&
        (el.label.toLowerCase().includes(q) || el.id.toLowerCase().includes(q))
    );
  }, [search, allCanvasElements, currentMemberIds]);

  return (
    <div className="mt-2 rounded-md border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          autoFocus
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          placeholder="Search elements..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-40 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            {allCanvasElements.length === 0 ? "No elements on canvas." : "No matching elements."}
          </p>
        ) : (
          filtered.map((el) => {
            const state = simulationItemStateById[el.id] ?? "active";
            return (
              <button
                key={el.id}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                onClick={() => onAdd(el.id)}
              >
                <ElementStateIcon state={state} className="h-3 w-3 shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left">{el.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground capitalize">{el.type}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// Dependency Group Card component
function DependencyGroupCard({
  group,
  allCanvasElements,
  simulationItemStateById,
  onItemStateChange,
  onUpdate,
  onRemove,
}: {
  group: DependencyGroup;
  allCanvasElements: CanvasElement[];
  simulationItemStateById: Record<string, SimulationElementState>;
  onItemStateChange: (itemId: string, state: SimulationElementState) => void;
  onUpdate: (updated: DependencyGroup) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const total = group.memberIds.length;
  const groupStatus = computeGroupStatus(group, simulationItemStateById);

  const elementById = useMemo(() => {
    const map: Record<string, CanvasElement> = {};
    allCanvasElements.forEach((el) => { map[el.id] = el; });
    return map;
  }, [allCanvasElements]);

  const removeMember = useCallback(
    (memberId: string) => {
      const newMemberIds = group.memberIds.filter((id) => id !== memberId);
      const newTotal = newMemberIds.length;
      onUpdate({
        ...group,
        memberIds: newMemberIds,
        minHealthy: Math.min(group.minHealthy, Math.max(1, newTotal)),
        minDegraded: Math.min(group.minDegraded, Math.max(1, newTotal)),
      });
    },
    [group, onUpdate]
  );

  const addMember = useCallback(
    (memberId: string) => {
      if (group.memberIds.includes(memberId)) return;
      onUpdate({ ...group, memberIds: [...group.memberIds, memberId] });
    },
    [group, onUpdate]
  );

  const setMinHealthy = useCallback(
    (val: number) => {
      // Allow fractions 0–1 (proportion) or integers >= 1 (absolute count)
      const isFraction = val > 0 && val < 1;
      const clamped = isFraction ? Math.min(1, Math.max(0.01, val)) : Math.max(1, Math.min(val, total));
      onUpdate({ ...group, minHealthy: clamped, minDegraded: Math.min(group.minDegraded, clamped) });
    },
    [group, onUpdate, total]
  );

  const setMinDegraded = useCallback(
    (val: number) => {
      // 0 = never unavailable; (0,1) = fraction; >= 1 = absolute
      if (val === 0) { onUpdate({ ...group, minDegraded: 0 }); return; }
      const isFraction = val > 0 && val < 1;
      const clamped = isFraction ? Math.min(1, Math.max(0.01, val)) : Math.max(1, Math.min(val, total));
      onUpdate({ ...group, minDegraded: clamped });
    },
    [group, onUpdate, total]
  );

  const effHealthy = total > 0 ? resolveThreshold(group.minHealthy, total) : 0;
  const effDegraded = total > 0 ? (group.minDegraded === 0 ? 0 : resolveThreshold(group.minDegraded, total)) : 0;

  return (
    <div className="rounded-md border bg-card">
      {/* Card Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none focus:underline"
          value={group.label}
          onChange={(e) => onUpdate({ ...group, label: e.target.value })}
        />
        <GroupStatusBadge status={groupStatus} />
        <span className="text-xs text-muted-foreground">{total} member{total !== 1 ? "s" : ""}</span>
        <button
          className="ml-1 text-muted-foreground hover:text-destructive"
          title="Remove group"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t px-3 pb-3 pt-2 space-y-3">
          {/* Members List */}
          <div className="space-y-1">
            {total === 0 ? (
              <p className="text-xs text-muted-foreground">No members. Add elements below.</p>
            ) : (
              group.memberIds.map((memberId) => {
                const el = elementById[memberId];
                const label = el?.label ?? memberId;
                const state = simulationItemStateById[memberId] ?? "active";
                return (
                  <div
                    key={memberId}
                    className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
                  >
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => onItemStateChange(memberId, nextElementState(state))}
                      title={`Cycle state for ${label}`}
                    >
                      <ElementStateIcon state={state} className="h-3 w-3 shrink-0" />
                    </button>
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                      onClick={() => onItemStateChange(memberId, nextElementState(state))}
                    >
                      {elementStateLabel(state)}
                    </button>
                    <button
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeMember(memberId)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add member picker */}
          {pickerOpen ? (
            <MemberPicker
              currentMemberIds={group.memberIds}
              allCanvasElements={allCanvasElements}
              simulationItemStateById={simulationItemStateById}
              onAdd={(id) => { addMember(id); }}
              onClose={() => setPickerOpen(false)}
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs"
              onClick={() => setPickerOpen(true)}
            >
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Add Members
            </Button>
          )}

          {/* Thresholds */}
          {total > 0 && (
            <div className="rounded-md bg-muted/40 p-2 space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Health Thresholds (out of {total})
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 mr-1" />
                    Healthy when &ge;
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0.01}
                      max={total}
                      step={group.minHealthy > 0 && group.minHealthy < 1 ? 0.05 : 1}
                      value={group.minHealthy}
                      onChange={(e) => setMinHealthy(Number(e.target.value))}
                      className="h-7 w-20 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      {group.minHealthy > 0 && group.minHealthy < 1
                        ? <>{Math.round(group.minHealthy * 100)}% <span className="opacity-60">(={effHealthy})</span></>
                        : "active"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500 mr-1" />
                    Degraded when &ge;
                  </Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      max={total}
                      step={group.minDegraded > 0 && group.minDegraded < 1 ? 0.05 : 1}
                      value={group.minDegraded}
                      onChange={(e) => setMinDegraded(Number(e.target.value))}
                      className="h-7 w-20 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">
                      {group.minDegraded === 0
                        ? "(never ✗)"
                        : group.minDegraded > 0 && group.minDegraded < 1
                          ? <>{Math.round(group.minDegraded * 100)}% <span className="opacity-60">(={effDegraded})</span></>
                          : "active"}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {group.minHealthy > 0 && group.minHealthy < 1
                  ? <>Healthy threshold: <span className="font-medium text-foreground">{Math.round(group.minHealthy * 100)}% of {total} = {effHealthy} member{effHealthy !== 1 ? "s" : ""}</span> must be fully active.</>
                  : <>Healthy threshold: <span className="font-medium text-foreground">{effHealthy} of {total} member{total !== 1 ? "s" : ""}</span> must be fully active. Enter 0.01–0.99 to use a percentage instead.</>
                }
                {" "}
                {group.minDegraded === 0
                  ? <span className="text-amber-700">Unavailable is disabled — the group can only reach Degraded at worst.</span>
                  : group.minDegraded > 0 && group.minDegraded < 1
                    ? <>Degraded threshold: <span className="font-medium text-foreground">{Math.round(group.minDegraded * 100)}% of {total} = {effDegraded} member{effDegraded !== 1 ? "s" : ""}</span> must be alive (active or degraded). Set to 0 to never mark as Unavailable.</>
                    : <>Degraded threshold: <span className="font-medium text-foreground">{effDegraded} of {total} member{total !== 1 ? "s" : ""}</span> must be alive. Set to 0 to never mark as Unavailable.</>
                }
              </p>
              <p className="text-xs text-muted-foreground">
                {effDegraded === 0 ? (
                  <>
                    {effHealthy > 1 && <>{"\u2265" + effHealthy + " active \u2192 "}<span className="text-green-600 font-medium">Healthy</span>{" \u00B7 "}</>}
                    {"0\u2013" + (effHealthy - 1) + " active \u2192 "}
                    <span className="text-amber-600 font-medium">Degraded</span>
                    {effHealthy === 1 && <>{" \u00B7 "}{"\u2265" + effHealthy + " active \u2192 "}<span className="text-green-600 font-medium">Healthy</span></>}
                  </>
                ) : effDegraded >= effHealthy ? (
                  // degraded threshold equals healthy threshold — no separate degraded band
                  <>
                    {"<" + effDegraded + " active \u2192 "}
                    <span className="text-red-600 font-medium">Unavailable</span>
                    {" \u00B7 \u2265" + effHealthy + " active \u2192 "}
                    <span className="text-green-600 font-medium">Healthy</span>
                  </>
                ) : (
                  <>
                    {"<" + effDegraded + " active \u2192 "}
                    <span className="text-red-600 font-medium">Unavailable</span>
                    {" \u00B7 "}
                    {effDegraded + "\u2013" + (effHealthy - 1) + " active \u2192 "}
                    <span className="text-amber-600 font-medium">Degraded</span>
                    {" \u00B7 \u2265" + effHealthy + " active \u2192 "}
                    <span className="text-green-600 font-medium">Healthy</span>
                  </>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Dialog
export function SimulationAvailabilityWorkspace({
  open,
  onOpenChange,
  targetId,
  targetLabel,
  targetStatus,
  targetState,
  dependencyGroups,
  statusColors,
  statusTexts,
  statusShadowColors,
  stateColors,
  stateOpacity,
  dependencyOpacity,
  allCanvasElements,
  simulationItemStateById,
  onItemStateChange,
  onGroupsChange,
  onStatusColorChange,
  onStatusTextChange,
  onStatusShadowColorChange,
  onStateColorChange,
  onStateOpacityChange,
  onDependencyOpacityChange,
}: SimulationAvailabilityWorkspaceProps) {
  const addGroup = useCallback(() => {
    const newGroup: DependencyGroup = {
      id: generateGroupId(),
      label: "Group " + (dependencyGroups.length + 1),
      memberIds: [],
      minHealthy: 1,
      minDegraded: 1,
    };
    onGroupsChange([...dependencyGroups, newGroup]);
  }, [dependencyGroups, onGroupsChange]);

  const updateGroup = useCallback(
    (updated: DependencyGroup) => {
      onGroupsChange(dependencyGroups.map((g) => (g.id === updated.id ? updated : g)));
    },
    [dependencyGroups, onGroupsChange]
  );

  const removeGroup = useCallback(
    (groupId: string) => {
      onGroupsChange(dependencyGroups.filter((g) => g.id !== groupId));
    },
    [dependencyGroups, onGroupsChange]
  );

  const dependencyStatus = targetStatus;
  const statusDotColor = dependencyStatus === "green" ? "#22c55e" : dependencyStatus === "amber" ? "#f59e0b" : "#ef4444";
  const targetStateColor = stateColors[targetState];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Availability Simulation</DialogTitle>
          <DialogDescription>
            Configure dependency groups with AND logic between groups and threshold-based health within each group.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2 pr-1">
          {/* Target Summary */}
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span
                className="inline-block h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: statusDotColor }}
              />
              <span className="font-semibold truncate">{targetLabel}</span>
              <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: targetStateColor }} />
              <button
                type="button"
                className="rounded"
                onClick={() => onItemStateChange(targetId, nextElementState(targetState))}
                title={`Cycle state for ${targetLabel}`}
              >
              <Badge variant={targetState === "active" ? "default" : targetState === "degraded" ? "secondary" : "destructive"}>
                {targetState === "active" ? "Active" : targetState === "degraded" ? "Degraded" : "Inactive"}
              </Badge>
              </button>
              <span className="text-xs text-muted-foreground">Dependencies</span>
              <GroupStatusBadge status={dependencyStatus} />
            </div>
            {dependencyGroups.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {dependencyGroups.length} group{dependencyGroups.length !== 1 ? "s" : ""} &middot; all groups must pass (AND logic)
              </p>
            )}
          </div>

          {/* Legend */}
          <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground space-y-0.5">
            <div className="font-medium text-foreground mb-1">How it works</div>
            <div>&bull; Click a state dot or state badge in this dialog to cycle: Active &rarr; Degraded &rarr; Inactive.</div>
            <div>&bull; Each group computes its own health based on its members&apos; states and the thresholds below.</div>
            <div>&bull; The element&apos;s own state is separate from dependency health. Dependencies are <span className="text-red-600 font-medium">Unavailable</span> if any group is unavailable, <span className="text-amber-600 font-medium">Degraded</span> if any group is degraded, and <span className="text-green-600 font-medium">Healthy</span> otherwise.</div>
          </div>

          {/* Dependency Groups */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Dependency Groups</Label>
              <Button type="button" variant="outline" size="sm" onClick={addGroup} className="h-7 text-xs">
                <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
                Add Group
              </Button>
            </div>
            {dependencyGroups.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No dependency groups yet.{" "}
                <button className="underline hover:text-foreground" onClick={addGroup}>
                  Add one
                </button>{" "}
                to configure availability logic.
              </div>
            ) : (
              <div className="space-y-2">
                {dependencyGroups.map((group, idx) => (
                  <React.Fragment key={group.id}>
                    <DependencyGroupCard
                      group={group}
                      allCanvasElements={allCanvasElements}
                      simulationItemStateById={simulationItemStateById}
                      onItemStateChange={onItemStateChange}
                      onUpdate={updateGroup}
                      onRemove={() => removeGroup(group.id)}
                    />
                    {idx < dependencyGroups.length - 1 && (
                      <div className="flex items-center gap-2 px-2">
                        <div className="flex-1 border-t border-dashed" />
                        <span className="text-xs font-semibold text-muted-foreground bg-background px-1">AND</span>
                        <div className="flex-1 border-t border-dashed" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          {/* Status Colors */}
          <div className="space-y-2">
            <Label className="text-sm">Status Colors</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["green", "amber", "red"] as AvailabilityStatus[]).map((status) => (
                <div key={status} className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {statusLabel(status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={statusColors[status]}
                      onChange={(e) => onStatusColorChange(status, e.target.value)}
                      className="h-9 w-14 p-1"
                    />
                    <Input
                      value={statusColors[status]}
                      onChange={(e) => onStatusColorChange(status, e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                  <Input
                    value={statusTexts[status] ?? ""}
                    onChange={(e) => onStatusTextChange(status, e.target.value)}
                    placeholder="Notification text"
                    className="text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={statusShadowColors[status]}
                      onChange={(e) => onStatusShadowColorChange(status, e.target.value)}
                      className="h-9 w-14 p-1"
                    />
                    <Input
                      value={statusShadowColors[status]}
                      onChange={(e) => onStatusShadowColorChange(status, e.target.value)}
                      className="font-mono text-xs"
                      placeholder="Shadow color"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Self State Colors</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {(["active", "degraded", "inactive"] as SimulationElementState[]).map((state) => (
                <div key={state} className="space-y-1">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {elementStateLabel(state)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={stateColors[state]}
                      onChange={(e) => onStateColorChange(state, e.target.value)}
                      className="h-9 w-14 p-1"
                    />
                    <Input
                      value={stateColors[state]}
                      onChange={(e) => onStateColorChange(state, e.target.value)}
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm">Overlay Transparency</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Element State
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stronger dashed fill for the item&apos;s own degraded or inactive state.
                    </div>
                  </div>
                  <span className="text-xs font-medium text-foreground">{Math.round(stateOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={stateOpacity}
                  onChange={(e) => onStateOpacityChange(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Dependency Health
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Outer health border showing the effect from dependencies.
                    </div>
                  </div>
                  <span className="text-xs font-medium text-foreground">{Math.round(dependencyOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={dependencyOpacity}
                  onChange={(e) => onDependencyOpacityChange(Number(e.target.value))}
                  className="w-full accent-green-600"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
