"use client";

import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, PlusCircle, Trash2, DollarSign, Download, Scale } from "lucide-react";

export interface CostContributor {
  id: string;
  multiplier: number;
}

export type CostScenarioProfile =
  | "generic"
  | "platform-engineering"
  | "sre-resilience"
  | "data-ai-pipeline"
  | "network"
  | "cloud"
  | "onprem-datacenter";

export interface CostScenarioInputs {
  quantity: number;
  utilization: number;
  periods: number;
  periodUnit?: string;
}

export type ChargingRuleKind = "fixed";

export interface ChargingRule {
  id: string;
  name: string;
  description?: string;
  kind: ChargingRuleKind;
  value: number;
  period: string;
  enabled: boolean;
  scenarioInputs?: CostScenarioInputs;
}

interface CanvasElement {
  id: string;
  label: string;
  type: "node" | "zone" | "connection";
}

interface SimulationCostWorkspaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetId: string;
  targetLabel: string;
  baseCost: number;
  currency: string;
  period: string;
  scenarioProfile: CostScenarioProfile;
  scenarioInputs: CostScenarioInputs;
  chargingRules: ChargingRule[];
  contributors: CostContributor[];
  directCost: number;
  totalCost: number;
  allCanvasElements: CanvasElement[];
  reportRows: Array<{
    id: string;
    label: string;
    type: "node" | "zone" | "connection";
    direct: number;
    total: number;
    rules: number;
    currency: string;
    period: string;
    rulePeriods: string;
    contributors: number;
    scenarioProfile: CostScenarioProfile;
    scenarioInputs: CostScenarioInputs;
  }>;
  onBaseCostChange: (value: number) => void;
  onCurrencyChange: (value: string) => void;
  onPeriodChange: (value: string) => void;
  onScenarioProfileChange: (value: CostScenarioProfile) => void;
  onScenarioInputsChange: (value: CostScenarioInputs) => void;
  onChargingRulesChange: (rules: ChargingRule[]) => void;
  onContributorsChange: (contributors: CostContributor[]) => void;
}

function fmtMoney(value: number, currency: string): string {
  const safeCurrency = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${safeCurrency} ${value.toFixed(2)}`;
  }
}

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "NZD", label: "NZD - New Zealand Dollar" },
  { value: "SGD", label: "SGD - Singapore Dollar" },
  { value: "HKD", label: "HKD - Hong Kong Dollar" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "INR", label: "INR - Indian Rupee" },
  { value: "CNY", label: "CNY - Chinese Yuan" },
  { value: "KRW", label: "KRW - South Korean Won" },
  { value: "NOK", label: "NOK - Norwegian Krone" },
  { value: "SEK", label: "SEK - Swedish Krona" },
  { value: "DKK", label: "DKK - Danish Krone" },
  { value: "PLN", label: "PLN - Polish Zloty" },
  { value: "BRL", label: "BRL - Brazilian Real" },
  { value: "MXN", label: "MXN - Mexican Peso" },
  { value: "ZAR", label: "ZAR - South African Rand" },
  { value: "AED", label: "AED - UAE Dirham" },
  { value: "SAR", label: "SAR - Saudi Riyal" },
  { value: "TRY", label: "TRY - Turkish Lira" },
  { value: "THB", label: "THB - Thai Baht" },
  { value: "IDR", label: "IDR - Indonesian Rupiah" },
  { value: "MYR", label: "MYR - Malaysian Ringgit" },
  { value: "PHP", label: "PHP - Philippine Peso" },
  { value: "HUF", label: "HUF - Hungarian Forint" },
  { value: "CZK", label: "CZK - Czech Koruna" },
  { value: "ILS", label: "ILS - Israeli Shekel" },
  { value: "RUB", label: "RUB - Russian Ruble" },
  { value: "CLP", label: "CLP - Chilean Peso" },
];

const PERIOD_OPTIONS = [
  { value: "second", label: "Per second" },
  { value: "minute", label: "Per minute" },
  { value: "hour", label: "Per hour" },
  { value: "request", label: "Per request" },
  { value: "transaction", label: "Per transaction" },
  { value: "event", label: "Per event" },
  { value: "build", label: "Per build" },
  { value: "deployment", label: "Per deployment" },
  { value: "day", label: "Per day" },
  { value: "week", label: "Per week" },
  { value: "month", label: "Per month" },
  { value: "half-year", label: "Per half-year" },
  { value: "quarter", label: "Per quarter" },
  { value: "year", label: "Per year" },
];

const TIME_PERIOD_OPTIONS = PERIOD_OPTIONS.filter((option) =>
  option.value === "second"
  || option.value === "minute"
  || option.value === "hour"
  || option.value === "day"
  || option.value === "week"
  || option.value === "month"
  || option.value === "quarter"
  || option.value === "half-year"
  || option.value === "year",
);

const TIME_PERIOD_SECONDS: Record<string, number> = {
  second: 1,
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
  month: 60 * 60 * 24 * 30,
  quarter: 60 * 60 * 24 * 90,
  "half-year": 60 * 60 * 24 * 182.5,
  year: 60 * 60 * 24 * 365,
};

const USAGE_PERIOD_SET = new Set(["request", "transaction", "event", "build", "deployment"]);

function isUsagePeriod(period: string): boolean {
  return USAGE_PERIOD_SET.has(period);
}

function getUsageUnitsPerSecond(inputs?: CostScenarioInputs): number {
  const quantity = Number.isFinite(inputs?.quantity) ? Math.max(0, Number(inputs?.quantity)) : 0;
  const utilization = Number.isFinite(inputs?.utilization) ? Math.min(Math.max(Number(inputs?.utilization), 0), 1) : 1;
  const periods = Number.isFinite(inputs?.periods) ? Math.max(1, Number(inputs?.periods)) : 1;
  const periodUnit = inputs?.periodUnit && TIME_PERIOD_SECONDS[inputs.periodUnit] ? inputs.periodUnit : "month";
  const unitSeconds = TIME_PERIOD_SECONDS[periodUnit] ?? 0;
  if (unitSeconds <= 0) return 0;
  return (quantity * utilization) / (periods * unitSeconds);
}

function normalizeScenarioInputs(inputs?: CostScenarioInputs): CostScenarioInputs {
  return {
    quantity: Number.isFinite(inputs?.quantity) ? Math.max(0, Number(inputs?.quantity)) : 1,
    utilization: Number.isFinite(inputs?.utilization)
      ? Math.min(Math.max(Number(inputs?.utilization), 0), 1)
      : 1,
    periods: Number.isFinite(inputs?.periods) ? Math.max(1, Number(inputs?.periods)) : 1,
    periodUnit:
      inputs?.periodUnit && TIME_PERIOD_SECONDS[inputs.periodUnit]
        ? inputs.periodUnit
        : "month",
  };
}

function getPeriodMultiplier(
  fromPeriod: string,
  toPeriod: string,
  fromInputs?: CostScenarioInputs,
  toInputs?: CostScenarioInputs,
): number {
  if (fromPeriod === toPeriod) return 1;

  const fromIsUsage = isUsagePeriod(fromPeriod);
  const toIsUsage = isUsagePeriod(toPeriod);

  if (!fromIsUsage && !toIsUsage) {
    const fromSeconds = TIME_PERIOD_SECONDS[fromPeriod];
    const toSeconds = TIME_PERIOD_SECONDS[toPeriod];
    if (!fromSeconds || !toSeconds) return 1;
    return toSeconds / fromSeconds;
  }

  if (fromIsUsage && !toIsUsage) {
    const toSeconds = TIME_PERIOD_SECONDS[toPeriod];
    const fromRate = getUsageUnitsPerSecond(fromInputs);
    if (!toSeconds || fromRate <= 0) return 0;
    return fromRate * toSeconds;
  }

  if (!fromIsUsage && toIsUsage) {
    const fromSeconds = TIME_PERIOD_SECONDS[fromPeriod];
    const toRate = getUsageUnitsPerSecond(toInputs);
    if (!fromSeconds || toRate <= 0) return 0;
    const usageUnitsInFromPeriod = toRate * fromSeconds;
    if (usageUnitsInFromPeriod <= 0) return 0;
    return 1 / usageUnitsInFromPeriod;
  }

  const fromRate = getUsageUnitsPerSecond(fromInputs);
  const toRate = getUsageUnitsPerSecond(toInputs);
  if (fromRate <= 0 || toRate <= 0) return 0;
  return fromRate / toRate;
}

export function SimulationCostWorkspace({
  open,
  onOpenChange,
  targetId,
  targetLabel,
  baseCost,
  currency,
  period,
  scenarioProfile,
  scenarioInputs,
  chargingRules,
  contributors,
  directCost,
  totalCost,
  allCanvasElements,
  reportRows,
  onBaseCostChange,
  onCurrencyChange,
  onPeriodChange,
  onScenarioProfileChange,
  onScenarioInputsChange,
  onChargingRulesChange,
  onContributorsChange,
}: SimulationCostWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [baseline, setBaseline] = useState<{ direct: number; total: number } | null>(null);
  const [planName, setPlanName] = useState("Plan 1");
  const [analysisPlans, setAnalysisPlans] = useState<Array<{ id: string; name: string; contributorIds: string[] }>>([]);
  const [summaryPeriod, setSummaryPeriod] = useState(period);

  const contributorSet = useMemo(() => new Set(contributors.map((c) => c.id)), [contributors]);
  const reportRowById = useMemo(() => {
    const map = new Map<string, (typeof reportRows)[number]>();
    reportRows.forEach((row) => map.set(row.id, row));
    return map;
  }, [reportRows]);

  const currentTargetReportRow = useMemo(() => reportRowById.get(targetId), [reportRowById, targetId]);

  const currentTargetBasePeriod = currentTargetReportRow?.period || period;
  const summaryPeriodMultiplier = useMemo(
    () => getPeriodMultiplier(currentTargetBasePeriod, summaryPeriod, scenarioInputs, scenarioInputs),
    [currentTargetBasePeriod, scenarioInputs, summaryPeriod],
  );
  const summaryDirectCost = directCost * summaryPeriodMultiplier;
  const summaryTotalCost = totalCost * summaryPeriodMultiplier;
  const targetIsUsagePeriod = isUsagePeriod(currentTargetBasePeriod);
  const usagePeriodUnit =
    scenarioInputs.periodUnit && TIME_PERIOD_SECONDS[scenarioInputs.periodUnit]
      ? scenarioInputs.periodUnit
      : "month";
  const effectiveUsageRate =
    Math.max(0, Number.isFinite(scenarioInputs.quantity) ? Number(scenarioInputs.quantity) : 0)
    * Math.min(Math.max(Number.isFinite(scenarioInputs.utilization) ? Number(scenarioInputs.utilization) : 1, 0), 1);
  const effectiveUsagePeriods = Math.max(1, Number.isFinite(scenarioInputs.periods) ? Number(scenarioInputs.periods) : 1);
  const summaryBaseline = baseline
    ? {
        direct: baseline.direct * summaryPeriodMultiplier,
        total: baseline.total * summaryPeriodMultiplier,
      }
    : null;

  const selectedContributorRows = useMemo(
    () => contributors.map((contributor) => reportRowById.get(contributor.id)).filter(Boolean),
    [contributors, reportRowById],
  );

  const selectedContributorPlanTotals = useMemo(() => {
    return contributors.reduce(
      (acc, contributor) => {
        const row = reportRowById.get(contributor.id);
        if (!row) return acc;
        return {
          direct: acc.direct + row.direct,
          total: acc.total + row.total,
        };
      },
      { direct: 0, total: 0 },
    );
  }, [contributors, reportRowById]);

  const analysisPlanRows = useMemo(() => {
    return analysisPlans.map((plan) => {
      const rows = plan.contributorIds.map((id) => reportRowById.get(id)).filter(Boolean);
      const direct = rows.reduce((sum, row) => sum + (row?.direct ?? 0), 0);
      const total = rows.reduce((sum, row) => sum + (row?.total ?? 0), 0);
      return { ...plan, direct, total, count: rows.length };
    });
  }, [analysisPlans, reportRowById]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allCanvasElements.filter((el) => {
      if (el.id === targetId) return false;
      if (contributorSet.has(el.id)) return false;
      if (!q) return true;
      return el.label.toLowerCase().includes(q) || el.id.toLowerCase().includes(q);
    });
  }, [allCanvasElements, contributorSet, search, targetId]);

  const labelById = useMemo(() => {
    const map: Record<string, string> = {};
    allCanvasElements.forEach((el) => {
      map[el.id] = el.label;
    });
    return map;
  }, [allCanvasElements]);

  const scenarioProfiles: Array<{ id: CostScenarioProfile; label: string }> = [
    { id: "cloud", label: "Cloud / Data Center" },
    { id: "onprem-datacenter", label: "On-Prem / Data Center" },
    { id: "network", label: "Network" },
    { id: "platform-engineering", label: "Platform Engineering" },
    { id: "data-ai-pipeline", label: "Data & AI Pipeline" },
    { id: "sre-resilience", label: "SRE / Resilience" },
    { id: "generic", label: "Generic" },
  ];

  const templatesByProfile: Record<CostScenarioProfile, { rules: ChargingRule[] }> = {
    generic: {
      rules: [
        { id: "tmpl-generic-fixed", name: "Baseline fixed charge", kind: "fixed", value: 100, period, enabled: true },
      ],
    },
    "platform-engineering": {
      rules: [
        { id: "tmpl-pe-tooling", name: "Tooling overhead", kind: "fixed", value: 180, period, enabled: true },
      ],
    },
    "sre-resilience": {
      rules: [
        { id: "tmpl-sre-redundancy", name: "Redundancy fixed", kind: "fixed", value: 260, period, enabled: true },
        { id: "tmpl-sre-ops", name: "Reliability ops fixed", kind: "fixed", value: 9, period, enabled: true },
      ],
    },
    "data-ai-pipeline": {
      rules: [
        { id: "tmpl-ai-platform", name: "Pipeline platform fixed", kind: "fixed", value: 220, period, enabled: true },
      ],
    },
    network: {
      rules: [
        { id: "tmpl-network-overhead", name: "Ops overhead fixed", kind: "fixed", value: 12, period, enabled: true },
      ],
    },
    cloud: {
      rules: [
        { id: "tmpl-cloud-platform", name: "Platform surcharge", kind: "fixed", value: 40, period, enabled: true },
      ],
    },
    "onprem-datacenter": {
      rules: [
        { id: "tmpl-onprem-facility", name: "Facility overhead", kind: "fixed", value: 320, period, enabled: true },
      ],
    },
  };

  const exportCsv = () => {
    const header = [
      "id",
      "label",
      "type",
      "direct_cost",
      "total_cost",
      "rules",
      "currency",
      "period",
      "rule_periods",
      "contributors",
      "scenario_profile",
    ];
    const rows = reportRows.map((row) => {
      const rowMultiplier = getPeriodMultiplier(row.period || period, summaryPeriod, row.scenarioInputs, row.scenarioInputs);
      return [
        row.id,
        row.label,
        row.type,
        (row.direct * rowMultiplier).toFixed(2),
        (row.total * rowMultiplier).toFixed(2),
        String(row.rules),
        row.currency,
        summaryPeriod,
        row.rulePeriods,
        String(row.contributors),
        row.scenarioProfile,
      ];
    });

    const csv = [header, ...rows]
      .map((fields) =>
        fields
          .map((field) => `"${String(field).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cost-report-${targetId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Cost Simulation
          </DialogTitle>
          <DialogDescription>
            Configure direct cost and dependency rollups for this element.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border/60 bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Target</div>
            <div className="truncate text-sm font-medium">{targetLabel || targetId}</div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cost-base">Base cost</Label>
              <Input
                id="cost-base"
                type="number"
                inputMode="decimal"
                value={Number.isFinite(baseCost) ? String(baseCost) : "0"}
                onChange={(e) => onBaseCostChange(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost-currency">Currency</Label>
              <Select value={currency} onValueChange={onCurrencyChange}>
                <SelectTrigger id="cost-currency">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cost-period">Period</Label>
              <Select value={period} onValueChange={onPeriodChange}>
                <SelectTrigger id="cost-period">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-[11px] text-muted-foreground">Billing basis for the cost number above, such as per request, per hour, or per month.</div>
            </div>
          </div>

          {isUsagePeriod(period) ? (
            <div className="grid gap-3 rounded-md border border-border/60 bg-background p-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="usage-quantity">{`# of ${period}s`}</Label>
                <Input
                  id="usage-quantity"
                  type="number"
                  inputMode="decimal"
                  value={String(Number.isFinite(scenarioInputs.quantity) ? scenarioInputs.quantity : 0)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    onScenarioInputsChange({
                      ...scenarioInputs,
                      quantity: Number.isFinite(next) ? Math.max(0, next) : 0,
                    });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage-period-count">Per every</Label>
                <Input
                  id="usage-period-count"
                  type="number"
                  inputMode="decimal"
                  value={String(Number.isFinite(scenarioInputs.periods) ? scenarioInputs.periods : 1)}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    onScenarioInputsChange({
                      ...scenarioInputs,
                      periods: Number.isFinite(next) ? Math.max(1, next) : 1,
                    });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="usage-period-unit">Time period</Label>
                <Select
                  value={scenarioInputs.periodUnit && TIME_PERIOD_SECONDS[scenarioInputs.periodUnit] ? scenarioInputs.periodUnit : "month"}
                  onValueChange={(nextPeriodUnit) =>
                    onScenarioInputsChange({
                      ...scenarioInputs,
                      periodUnit: nextPeriodUnit,
                    })
                  }
                >
                  <SelectTrigger id="usage-period-unit">
                    <SelectValue placeholder="Select time period" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PERIOD_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-3 text-[11px] text-muted-foreground">
                Used to normalize usage-based costs across time periods and mixed rollups.
              </div>
            </div>
          ) : null}

          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="text-sm font-medium">Scenario profile</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scenarioProfiles.map((profile) => (
                <Button
                  key={profile.id}
                  type="button"
                  variant={scenarioProfile === profile.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => onScenarioProfileChange(profile.id)}
                  className="h-7 px-2 text-xs"
                >
                  {profile.label}
                </Button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const template = templatesByProfile[scenarioProfile];
                  onChargingRulesChange(template.rules.map((rule, idx) => ({ ...rule, id: `${rule.id}-${idx}` })));
                }}
              >
                Apply profile defaults
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onChargingRulesChange([]);
                }}
              >
                Reset profile inputs
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Analysis plans</div>
              <Badge variant="secondary">{analysisPlanRows.length}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Build a plan by summing selected contributors. Contributors are the first-level cost-bearing elements with their own base cost and charging rules.
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                className="max-w-[220px]"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Plan name"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (contributors.length === 0) return;
                  setAnalysisPlans((prev) => [
                    ...prev,
                    {
                      id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                      name: planName.trim() || `Plan ${prev.length + 1}`,
                      contributorIds: contributors.map((contributor) => contributor.id),
                    },
                  ]);
                  setPlanName((prev) => prev || "Plan 1");
                }}
                disabled={contributors.length === 0}
              >
                Save from selected contributors
              </Button>
            </div>
            <div className="mt-3 rounded border border-border/50 bg-muted/20 p-2 text-xs text-muted-foreground">
              Current selection total: direct {fmtMoney(selectedContributorPlanTotals.direct, currency || "USD")} | total {fmtMoney(selectedContributorPlanTotals.total, currency || "USD")}
            </div>
            {selectedContributorRows.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                {selectedContributorRows.map((row) => (
                  <span key={row!.id} className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5">
                    {row!.label} · {row!.rules} rules
                  </span>
                ))}
              </div>
            ) : null}
            <div className="mt-3 space-y-2">
              {analysisPlanRows.length === 0 ? (
                <div className="text-xs text-muted-foreground">No saved plans yet.</div>
              ) : (
                analysisPlanRows.map((plan) => (
                  <div key={plan.id} className="rounded border border-border/50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{plan.name}</div>
                      <Badge variant="secondary">{plan.count} contributors</Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Direct {fmtMoney(plan.direct, currency || "USD")} | Total {fmtMoney(plan.total, currency || "USD")}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Plan comparison</div>
              <Scale className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Capture a baseline for the current plan, then compare another contributor set or rule change against it.
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBaseline({ direct: directCost, total: totalCost })}
              >
                Set baseline
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setBaseline(null)}
                disabled={!baseline}
              >
                Clear baseline
              </Button>
            </div>
            {baseline ? (
              <div className="mt-2 text-xs text-muted-foreground">
                Delta direct: {fmtMoney(directCost - baseline.direct, currency || "USD")} | Delta total: {fmtMoney(totalCost - baseline.total, currency || "USD")}
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">Capture a baseline, then modify rules/inputs to compare deltas.</div>
            )}
          </div>

          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">Charging rules</div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const nextRule: ChargingRule = {
                    id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                    name: `Rule ${chargingRules.length + 1}`,
                    description: "Describe what this charge covers, when it applies, and any assumptions.",
                    kind: "fixed",
                    value: 0,
                    period,
                    enabled: true,
                    scenarioInputs: normalizeScenarioInputs(scenarioInputs),
                  };
                  onChargingRulesChange([...chargingRules, nextRule]);
                }}
              >
                Add rule
              </Button>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Define each rule with its own amount and billing period. The rule no longer inherits the element base cost.
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">Fixed charges stay flat and can use their own billing period.</div>
            <div className="mt-3 space-y-2">
              {chargingRules.length === 0 ? (
                <div className="text-xs text-muted-foreground">No charging rules yet.</div>
              ) : (
                chargingRules.map((rule) => (
                  (() => {
                    const ruleScenarioInputs = normalizeScenarioInputs(rule.scenarioInputs ?? scenarioInputs);
                    const ruleEffectiveRate = Math.max(0, ruleScenarioInputs.quantity) * ruleScenarioInputs.utilization;
                    const ruleEffectivePeriods = Math.max(1, ruleScenarioInputs.periods);
                    const ruleEffectivePeriodUnit =
                      ruleScenarioInputs.periodUnit && TIME_PERIOD_SECONDS[ruleScenarioInputs.periodUnit]
                        ? ruleScenarioInputs.periodUnit
                        : "month";
                    return (
                  <div key={rule.id} className="grid gap-2 rounded border border-border/50 p-2 sm:grid-cols-[1fr_140px_120px_140px_auto_auto]">
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-foreground/80">Rule name</Label>
                        <Input
                          value={rule.name}
                          onChange={(e) =>
                            onChargingRulesChange(
                              chargingRules.map((r) => (r.id === rule.id ? { ...r, name: e.target.value } : r)),
                            )
                          }
                          placeholder="Rule name"
                        />
                        <div className="text-[11px] text-muted-foreground">Short rule label.</div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] text-foreground/80">Description</Label>
                        <Input
                          value={rule.description || ""}
                          onChange={(e) =>
                            onChargingRulesChange(
                              chargingRules.map((r) => (r.id === rule.id ? { ...r, description: e.target.value } : r)),
                            )
                          }
                          placeholder="Description"
                        />
                        <div className="text-[11px] text-muted-foreground">What this charge represents and when it applies.</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-foreground/80">Type</Label>
                      <Select
                        value={rule.kind}
                        onValueChange={(nextKind) =>
                          onChargingRulesChange(
                            chargingRules.map((r) =>
                              r.id === rule.id ? { ...r, kind: nextKind as ChargingRuleKind } : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">Fixed</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="text-[11px] text-muted-foreground">Flat fee only; use the period to normalize it when needed.</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-foreground/80">Amount</Label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={String(rule.value)}
                        onChange={(e) => {
                          const next = Number(e.target.value);
                          onChargingRulesChange(
                            chargingRules.map((r) =>
                              r.id === rule.id
                                ? { ...r, value: Number.isFinite(next) ? next : 0 }
                                : r,
                            ),
                          );
                        }}
                        placeholder="Flat amount"
                      />
                      <div className="text-[11px] text-muted-foreground">Cost amount in the selected rule period.</div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] text-foreground/80">Period</Label>
                      <Select
                        value={rule.period || period}
                        onValueChange={(nextPeriod) =>
                          onChargingRulesChange(
                            chargingRules.map((r) =>
                              r.id === rule.id
                                ? {
                                    ...r,
                                    period: nextPeriod,
                                    scenarioInputs: r.scenarioInputs ?? normalizeScenarioInputs(scenarioInputs),
                                  }
                                : r,
                            ),
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent>
                          {PERIOD_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="text-[11px] text-muted-foreground">Billing period used by this rule.</div>
                      {isUsagePeriod(rule.period || period) ? (
                        <div className="mt-2 space-y-2 rounded border border-border/50 bg-muted/20 p-2">
                          <div className="space-y-1">
                            <Label className="text-[11px] text-foreground/80">{`# of ${rule.period || period}s`}</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={String(ruleScenarioInputs.quantity)}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                onChargingRulesChange(
                                  chargingRules.map((r) =>
                                    r.id === rule.id
                                      ? {
                                          ...r,
                                          scenarioInputs: {
                                            ...ruleScenarioInputs,
                                            quantity: Number.isFinite(next) ? Math.max(0, next) : 0,
                                          },
                                        }
                                      : r,
                                  ),
                                );
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-foreground/80">Per every</Label>
                            <Input
                              type="number"
                              inputMode="decimal"
                              value={String(ruleScenarioInputs.periods)}
                              onChange={(e) => {
                                const next = Number(e.target.value);
                                onChargingRulesChange(
                                  chargingRules.map((r) =>
                                    r.id === rule.id
                                      ? {
                                          ...r,
                                          scenarioInputs: {
                                            ...ruleScenarioInputs,
                                            periods: Number.isFinite(next) ? Math.max(1, next) : 1,
                                          },
                                        }
                                      : r,
                                  ),
                                );
                              }}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px] text-foreground/80">Time period</Label>
                            <Select
                              value={ruleScenarioInputs.periodUnit || "month"}
                              onValueChange={(nextPeriodUnit) =>
                                onChargingRulesChange(
                                  chargingRules.map((r) =>
                                    r.id === rule.id
                                      ? {
                                          ...r,
                                          scenarioInputs: {
                                            ...ruleScenarioInputs,
                                            periodUnit: nextPeriodUnit,
                                          },
                                        }
                                      : r,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select time period" />
                              </SelectTrigger>
                              <SelectContent>
                                {TIME_PERIOD_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Usage normalization for this rule when period is event/request/build/deployment.
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            Effective rule rate: {ruleEffectiveRate.toFixed(2)} {rule.period || period}
                            {ruleEffectiveRate === 1 ? "" : "s"} per {ruleEffectivePeriods} {ruleEffectivePeriodUnit}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant={rule.enabled ? "default" : "outline"}
                      size="sm"
                      onClick={() =>
                        onChargingRulesChange(
                          chargingRules.map((r) =>
                            r.id === rule.id ? { ...r, enabled: !r.enabled } : r,
                          ),
                        )
                      }
                    >
                      {rule.enabled ? "On" : "Off"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onChargingRulesChange(chargingRules.filter((r) => r.id !== rule.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                    );
                  })()
                ))
              )}
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-background p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">First-level contributors</div>
              <Badge variant="secondary">{contributors.length}</Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              These are the elements in scope. Each contributor carries its own base cost and charging rules, and plans sum selected contributors for analysis.
            </div>

            <div className="mt-3 space-y-2">
              {contributors.length === 0 ? (
                <div className="text-xs text-muted-foreground">No contributors added.</div>
              ) : (
                contributors.map((contributor) => (
                  <div
                    key={contributor.id}
                    className="grid items-center gap-2 rounded border border-border/50 p-2 sm:grid-cols-[1fr_120px_auto]"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm">{labelById[contributor.id] || contributor.id}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{contributor.id}</div>
                    </div>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={String(contributor.multiplier)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        onContributorsChange(
                          contributors.map((c) =>
                            c.id === contributor.id
                              ? { ...c, multiplier: Number.isFinite(next) ? next : 1 }
                              : c,
                          ),
                        );
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onContributorsChange(contributors.filter((c) => c.id !== contributor.id))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-3 rounded-md border border-border/50 bg-muted/20 p-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                Add contributor
              </div>
              <Input
                className="mt-2"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search node, zone, or connection"
              />
              <div className="mt-2 max-h-36 overflow-y-auto">
                {candidates.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No matching items.</div>
                ) : (
                  candidates.slice(0, 30).map((candidate) => (
                    <button
                      key={candidate.id}
                      className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                      onClick={() => {
                        onContributorsChange([...contributors, { id: candidate.id, multiplier: 1 }]);
                        setSearch("");
                      }}
                    >
                      <span className="min-w-0 truncate">{candidate.label}</span>
                      <PlusCircle className="h-4 w-4 text-primary" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">Summary period</div>
              <Select value={summaryPeriod} onValueChange={setSummaryPeriod}>
                <SelectTrigger className="h-8 w-[160px]">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Direct ({summaryPeriod})</div>
            <div className="text-base font-semibold">{fmtMoney(summaryDirectCost, currency || "USD")}</div>
            <div className="mt-2 text-xs text-muted-foreground">Rolled-up total ({summaryPeriod})</div>
            <div className="text-lg font-semibold">{fmtMoney(summaryTotalCost, currency || "USD")}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Formula: direct + sum(related total × multiplier)
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Rule periods: {currentTargetReportRow?.rulePeriods || currentTargetBasePeriod || "n/a"}
            </div>
            {targetIsUsagePeriod ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Effective rate: {effectiveUsageRate.toFixed(2)} {currentTargetBasePeriod}
                {effectiveUsageRate === 1 ? "" : "s"} per {effectiveUsagePeriods} {usagePeriodUnit}
              </div>
            ) : null}
            {summaryBaseline ? (
              <div className="mt-1 text-xs text-muted-foreground">
                Delta direct: {fmtMoney(summaryDirectCost - summaryBaseline.direct, currency || "USD")} | Delta total: {fmtMoney(summaryTotalCost - summaryBaseline.total, currency || "USD")}
              </div>
            ) : null}
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Export cost report CSV
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
