"use client";

import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, X, Plus, Trash2, Download, Upload, Pencil } from 'lucide-react';
import { useResourceTypes } from '@/hooks/use-resource-types';
import { evaluateRules } from '@/lib/rules-engine';
import type { DiagramRule, RulesFile } from '@/lib/rules-types';
import type { DiagramData } from '@/lib/types';
import { cn } from '@/lib/utils';

const RULE_OPERATORS: { value: DiagramRule['operator']; label: string }[] = [
  { value: 'must_have', label: 'Must have at least 1' },
  { value: 'must_have_at_least', label: 'Must have at least N' },
  { value: 'must_have_more_than', label: 'Must have more than N' },
  { value: 'must_have_exactly', label: 'Must have exactly N' },
  { value: 'must_have_all', label: 'Must have all types' },
];

interface RulesEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rules: DiagramRule[];
  onRulesChange: (rules: DiagramRule[]) => void;
  diagramData?: DiagramData | null;
}

function generateRuleId(): string {
  return `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function RulesEditor({
  open,
  onOpenChange,
  rules,
  onRulesChange,
  diagramData,
}: RulesEditorProps) {
  const { types } = useResourceTypes();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<DiagramRule>>({});
  const [customPattern, setCustomPattern] = useState('');

  const results = useMemo(
    () => (diagramData ? evaluateRules(rules, diagramData) : []),
    [diagramData, rules]
  );

  const handleAddRule = useCallback(() => {
    const newRule: DiagramRule = {
      id: generateRuleId(),
      name: 'New Rule',
      operator: 'must_have',
      typeValue: types[0]?.fullType ?? '',
      typeMatch: 'exact',
    };
    onRulesChange([newRule, ...rules]);
    setEditingId(newRule.id);
    setDraft(newRule);
  }, [rules, onRulesChange, types]);

  const handleDeleteRule = useCallback(
    (id: string) => {
      onRulesChange(rules.filter((r) => r.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setDraft({});
      }
    },
    [rules, onRulesChange, editingId]
  );

  const handleStartEdit = useCallback((rule: DiagramRule) => {
    setEditingId(rule.id);
    setDraft({ ...rule });
    setCustomPattern(rule.typeMatch === 'pattern' ? (rule.typeValue ?? '') : '');
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingId) return;
    const typeVal =
      draft.typeMatch === 'pattern'
        ? customPattern.trim()
        : (draft.typeValue ?? '').trim();
    const updated: DiagramRule = {
      id: editingId,
      name: (draft.name ?? 'Rule').trim() || 'Unnamed Rule',
      operator: draft.operator ?? 'must_have',
      typeValue: typeVal || undefined,
      count: draft.count,
      types: draft.operator === 'must_have_all' ? draft.types : undefined,
      typeMatch: draft.typeMatch ?? 'exact',
    };
    const next = rules.map((r) => (r.id === editingId ? updated : r));
    onRulesChange(next);
    setEditingId(null);
    setDraft({});
    setCustomPattern('');
  }, [editingId, draft, customPattern, rules, onRulesChange]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setDraft({});
    setCustomPattern('');
  }, []);

  const handleExport = useCallback(async () => {
    const file: RulesFile = {
      version: '1.0',
      name: 'Diagram Rules',
      rules,
    };
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: 'application/json',
    });
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'diagram-rules.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } catch (err) {
        if ((err as Error).name !== 'AbortError') throw err;
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagram-rules.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [rules]);

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result as string) as RulesFile;
          if (parsed.version === '1.0' && Array.isArray(parsed.rules)) {
            const withIds = parsed.rules.map((r) => ({
              ...r,
              id: r.id || generateRuleId(),
            }));
            onRulesChange(withIds);
          }
        } catch {
          // Invalid JSON - ignore
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [onRulesChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Rules Editor</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Define validation rules for your diagram. Rules are optional and can be exported or imported as JSON.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleAddRule}>
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export Rules
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            Import Rules
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={handleImport}
          />
        </div>
        <div className="border rounded-md p-2 space-y-2 min-h-[120px]">
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No rules defined. Add a rule to get started.
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => {
                const result = results.find((r) => r.rule.id === rule.id);
                const isEditing = editingId === rule.id;
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'border rounded-lg p-3',
                      result?.passed ? 'border-green-500/30 bg-green-500/5' : 'border-destructive/30 bg-destructive/5'
                    )}
                  >
                    {isEditing ? (
                      <RuleEditForm
                        draft={draft}
                        setDraft={setDraft}
                        customPattern={customPattern}
                        setCustomPattern={setCustomPattern}
                        types={types}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                      />
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {result ? (
                              result.passed ? (
                                <Check className="h-5 w-5 text-green-600 shrink-0" />
                              ) : (
                                <X className="h-5 w-5 text-destructive shrink-0" />
                              )
                            ) : (
                              <span className="w-5 h-5 shrink-0" />
                            )}
                            <span className="font-medium truncate">{rule.name}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {formatRuleDescription(rule)}
                          </p>
                          {result && !result.passed && (
                            <p className="text-sm text-destructive mt-1">{result.message}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="icon" variant="ghost" onClick={() => handleStartEdit(rule)} title="Edit rule">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteRule(rule.id)} title="Delete rule">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatRuleDescription(rule: DiagramRule): string {
  switch (rule.operator) {
    case 'must_have':
      return `Must have at least 1 object of type "${rule.typeValue ?? '?'}"`;
    case 'must_have_at_least':
      return `Must have at least ${rule.count ?? 0} of "${rule.typeValue ?? '?'}"`;
    case 'must_have_more_than':
      return `Must have more than ${rule.count ?? 0} of "${rule.typeValue ?? '?'}"`;
    case 'must_have_exactly':
      return `Must have exactly ${rule.count ?? 0} of "${rule.typeValue ?? '?'}"`;
    case 'must_have_all':
      return `Must have all: ${(rule.types ?? []).join(', ')}`;
    default:
      return rule.name;
  }
}

interface RuleEditFormProps {
  draft: Partial<DiagramRule>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<DiagramRule>>>;
  customPattern: string;
  setCustomPattern: (v: string) => void;
  types: { fullType: string; label: string }[];
  onSave: () => void;
  onCancel: () => void;
}

const MAX_TYPE_OPTIONS = 60;

const TypeSelect = React.memo(function TypeSelect({
  value,
  onChange,
  types,
}: {
  value: string;
  onChange: (v: string) => void;
  types: { fullType: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return types.slice(0, MAX_TYPE_OPTIONS);
    return types
      .filter((t) => t.fullType.toLowerCase().includes(q) || t.label.toLowerCase().includes(q))
      .slice(0, MAX_TYPE_OPTIONS);
  }, [types, search]);
  const displayLabel = useMemo(() => {
    const t = types.find((x) => x.fullType === value);
    return t ? `${t.label} (${t.fullType})` : value || '';
  }, [types, value]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{displayLabel || 'Select type...'}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Input
          placeholder="Search types..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-b-none border-b"
        />
        <ScrollArea className="max-h-[240px]">
          <div className="p-1">
            {filtered.map((t) => (
              <button
                key={t.fullType}
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent',
                  value === t.fullType && 'bg-accent'
                )}
                onClick={() => {
                  onChange(t.fullType);
                  setOpen(false);
                  setSearch('');
                }}
              >
                <span className="truncate">
                  {t.label} ({t.fullType})
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="py-6 text-center text-sm text-muted-foreground">No types found</div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
});

function RuleEditForm({
  draft,
  setDraft,
  customPattern,
  setCustomPattern,
  types,
  onSave,
  onCancel,
}: RuleEditFormProps) {
  const handleTypeChange = useCallback(
    (v: string) => setDraft((p) => ({ ...p, typeValue: v })),
    [setDraft]
  );
  const needsCount =
    draft.operator === 'must_have_at_least' ||
    draft.operator === 'must_have_more_than' ||
    draft.operator === 'must_have_exactly';
  const isMustHaveAll = draft.operator === 'must_have_all';

  return (
    <div className="space-y-3">
      <div>
        <Label>Rule Name</Label>
        <Input
          value={draft.name ?? ''}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
          placeholder="e.g. Must have database"
        />
      </div>
      <div>
        <Label>Operator</Label>
        <Select
          value={draft.operator ?? 'must_have'}
          onValueChange={(v) =>
            setDraft((p) => ({ ...p, operator: v as DiagramRule['operator'] }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_OPERATORS.map((op) => (
              <SelectItem key={op.value} value={op.value}>
                {op.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isMustHaveAll ? (
        <div>
          <Label>Types (one per line)</Label>
          <Textarea
            value={(draft.types ?? []).join('\n')}
            onChange={(e) =>
              setDraft((p) => ({
                ...p,
                types: e.target.value.split('\n').map((t) => t.trim()).filter(Boolean),
              }))
            }
            placeholder={'aws.database.rds\naws.compute.ec2-instance'}
            className="min-h-[80px]"
          />
        </div>
      ) : (
        <>
          <div>
            <Label>Type Match</Label>
            <Select
              value={draft.typeMatch ?? 'exact'}
              onValueChange={(v) =>
                setDraft((p) => ({ ...p, typeMatch: v as 'exact' | 'pattern' }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact type</SelectItem>
                <SelectItem value="pattern">Pattern (use * as wildcard)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft.typeMatch === 'pattern' ? (
            <div>
              <Label>Type Pattern</Label>
              <Input
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
                placeholder="e.g. aws.database.* or *.database.*"
              />
            </div>
          ) : (
            <div>
              <Label>Object Type</Label>
              <TypeSelect
                value={draft.typeValue ?? ''}
                onChange={handleTypeChange}
                types={types}
              />
            </div>
          )}
          {needsCount && (
            <div>
              <Label>Count (N)</Label>
              <Input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={draft.count !== undefined && draft.count !== null ? String(draft.count) : ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') {
                    setDraft((p) => ({ ...p, count: undefined }));
                  } else {
                    const num = parseInt(v, 10);
                    if (!isNaN(num) && num >= 0) {
                      setDraft((p) => ({ ...p, count: num }));
                    }
                  }
                }}
              />
            </div>
          )}
        </>
      )}
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onSave}>
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
