"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, RefreshCw, Sparkles, Trash2, Wrench, X } from 'lucide-react';
import {
  authenticateMaintenance,
  checkMaintenanceHealth,
  confirmMaintenanceIcon,
  deleteMaintenanceIcon,
  generateMaintenanceIcon,
  listMaintenanceIcons,
  type MaintenanceIconItem,
} from '@/lib/maintenance-api';
import {
  getMaintenanceApiUrl,
  isMaintenanceConfigured,
  MAINTENANCE_TOKEN_KEY,
} from '@/lib/maintenance-config';

interface IconMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type DialogPhase = 'password' | 'generate' | 'review' | 'confirmed';

function LlmIconLibrary({
  icons,
  loading,
  busy,
  activeFileName,
  iconsRevision,
  onDelete,
  onRecreate,
}: {
  icons: MaintenanceIconItem[];
  loading: boolean;
  busy: boolean;
  activeFileName: string | null;
  iconsRevision: number;
  onDelete: (icon: MaintenanceIconItem) => void;
  onRecreate: (icon: MaintenanceIconItem) => void;
}) {
  return (
    <div className="space-y-2 border-t border-violet-200/80 pt-3 dark:border-violet-800/80">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-violet-900/90 dark:text-violet-200/90">
          Saved LLM icons
        </h4>
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-700 dark:text-violet-300" />
        ) : (
          <span className="text-xs text-violet-800/70 dark:text-violet-200/65">{icons.length}</span>
        )}
      </div>
      {icons.length === 0 && !loading ? (
        <p className="text-xs text-violet-800/75 dark:text-violet-200/70">
          No saved icons yet. Generate one below.
        </p>
      ) : (
        <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-1">
          {icons.map((icon) => {
            const rowBusy = busy && activeFileName === icon.fileName;
            return (
              <li
                key={icon.fileName}
                className="flex items-center gap-2 rounded-md border border-violet-200/80 bg-violet-100/50 px-2 py-1.5 dark:border-violet-800/80 dark:bg-violet-900/30"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-violet-200/80 bg-white p-1 dark:border-violet-700 dark:bg-violet-950/50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${icon.publicPath}?r=${iconsRevision}`}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-violet-950 dark:text-violet-50">
                    {icon.name}
                  </p>
                  <p className="truncate font-mono text-[10px] text-violet-800/70 dark:text-violet-200/65">
                    {icon.fileName}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2"
                    disabled={busy}
                    onClick={() => onRecreate(icon)}
                    title="Recreate with LLM"
                  >
                    {rowBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-red-700 hover:text-red-800 dark:text-red-400"
                    disabled={busy}
                    onClick={() => onDelete(icon)}
                    title="Delete icon"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function IconMaintenanceDialog({
  open,
  onOpenChange,
}: IconMaintenanceDialogProps) {
  const configured = isMaintenanceConfigured();
  const apiUrl = getMaintenanceApiUrl();

  const [phase, setPhase] = React.useState<DialogPhase>('password');
  const [password, setPassword] = React.useState('');
  const [token, setToken] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [previewSvg, setPreviewSvg] = React.useState<string | null>(null);
  const [generateAttempt, setGenerateAttempt] = React.useState(1);
  const [lastResult, setLastResult] = React.useState<{
    resourceType: string;
    publicPath: string;
    name: string;
  } | null>(null);
  const [serverInfo, setServerInfo] = React.useState<{
    model?: string;
    ollamaUrl?: string;
  } | null>(null);
  const [savedIcons, setSavedIcons] = React.useState<MaintenanceIconItem[]>([]);
  const [iconsLoading, setIconsLoading] = React.useState(false);
  const [replaceMode, setReplaceMode] = React.useState(false);
  const [replaceFileName, setReplaceFileName] = React.useState<string | null>(null);
  const [activeFileName, setActiveFileName] = React.useState<string | null>(null);
  const [iconsRevision, setIconsRevision] = React.useState(0);

  const loadSavedIcons = React.useCallback(async (authToken: string) => {
    setIconsLoading(true);
    try {
      const result = await listMaintenanceIcons(authToken);
      setSavedIcons(result.icons ?? []);
      setIconsRevision((r) => r + 1);
    } catch {
      setSavedIcons([]);
    } finally {
      setIconsLoading(false);
    }
  }, []);

  const resetState = React.useCallback(() => {
    setPhase('password');
    setPassword('');
    setToken(null);
    setName('');
    setDescription('');
    setBusy(false);
    setError(null);
    setStatusMessage(null);
    setPreviewSvg(null);
    setGenerateAttempt(1);
    setLastResult(null);
    setServerInfo(null);
    setSavedIcons([]);
    setIconsLoading(false);
    setReplaceMode(false);
    setReplaceFileName(null);
    setActiveFileName(null);
    setIconsRevision(0);
    try {
      sessionStorage.removeItem(MAINTENANCE_TOKEN_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  React.useEffect(() => {
    if (!open) {
      resetState();
      return;
    }

    if (!configured) return;

    let cancelled = false;
    (async () => {
      try {
        const health = await checkMaintenanceHealth();
        if (cancelled) return;
        setServerInfo({ model: health.model, ollamaUrl: health.ollamaUrl });
        if (!health.passwordConfigured) {
          setError('Maintenance server has no password configured.');
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Could not reach the maintenance server.',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, configured, resetState]);

  const handleClose = React.useCallback(() => {
    resetState();
    onOpenChange(false);
  }, [onOpenChange, resetState]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await authenticateMaintenance(password);
      if (!result.ok || !result.token) {
        throw new Error(result.error || 'Authentication failed.');
      }
      setToken(result.token);
      try {
        sessionStorage.setItem(MAINTENANCE_TOKEN_KEY, result.token);
      } catch {
        /* ignore */
      }
      setPhase('generate');
      setPassword('');
      void loadSavedIcons(result.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const runGeneration = React.useCallback(
    async (attempt: number) => {
      if (!token) {
        setPhase('password');
        return;
      }
      setError(null);
      setStatusMessage(
        attempt > 1
          ? `Retrying with Ollama (attempt ${attempt})…`
          : 'Sending request to Ollama — this may take a minute…',
      );
      setBusy(true);
      setPreviewSvg(null);

      try {
        const result = await generateMaintenanceIcon(token, {
          name,
          description,
          attempt,
          replace: replaceMode,
          replaceFileName: replaceFileName ?? undefined,
        });
        if (!result.ok || !result.svg) {
          throw new Error(result.error || 'Generation failed.');
        }
        setPreviewSvg(result.svg);
        setGenerateAttempt(attempt);
        setPhase('review');
        setStatusMessage(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed.';
        if (/unauthorized|sign in again/i.test(message)) {
          setToken(null);
          setPhase('password');
        }
        setError(message);
        setStatusMessage(null);
      } finally {
        setBusy(false);
      }
    },
    [token, name, description, replaceMode, replaceFileName],
  );

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await runGeneration(1);
  };

  const handleRetry = async () => {
    await runGeneration(generateAttempt + 1);
  };

  const handleConfirm = async () => {
    if (!token || !previewSvg) return;
    setError(null);
    setBusy(true);
    setStatusMessage('Saving icon to resources…');

    try {
      const result = await confirmMaintenanceIcon(token, {
        name,
        svg: previewSvg,
        replace: replaceMode,
        replaceFileName: replaceFileName ?? undefined,
      });
      if (!result.ok) {
        throw new Error(result.error || 'Could not save icon.');
      }
      if (token) void loadSavedIcons(token);
      setReplaceMode(false);
      setReplaceFileName(null);
      setLastResult({
        resourceType: result.resourceType || '',
        publicPath: result.publicPath || '',
        name: result.name || name,
      });
      setPhase('confirmed');
      setStatusMessage(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save icon.';
      if (/unauthorized|sign in again/i.test(message)) {
        setToken(null);
        setPhase('password');
      }
      setError(message);
      setStatusMessage(null);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAnother = () => {
    setName('');
    setDescription('');
    setPreviewSvg(null);
    setGenerateAttempt(1);
    setLastResult(null);
    setError(null);
    setStatusMessage(null);
    setReplaceMode(false);
    setReplaceFileName(null);
    setPhase('generate');
  };

  const handleBackToForm = () => {
    setPreviewSvg(null);
    setGenerateAttempt(1);
    setError(null);
    setStatusMessage(null);
    setPhase('generate');
  };

  const handleRecreateIcon = (icon: MaintenanceIconItem) => {
    setName(icon.name);
    setDescription(`Regenerate the "${icon.name}" diagram icon with a fresh design.`);
    setReplaceMode(true);
    setReplaceFileName(icon.fileName);
    setPreviewSvg(null);
    setGenerateAttempt(1);
    setError(null);
    setStatusMessage(null);
    setPhase('generate');
  };

  const handleDeleteIcon = async (icon: MaintenanceIconItem) => {
    if (!token) return;
    if (!window.confirm(`Delete "${icon.name}" (${icon.fileName})? This cannot be undone.`)) {
      return;
    }
    setError(null);
    setBusy(true);
    setActiveFileName(icon.fileName);
    try {
      await deleteMaintenanceIcon(token, icon.fileName);
      await loadSavedIcons(token);
      if (replaceFileName === icon.fileName) {
        setReplaceMode(false);
        setReplaceFileName(null);
        setName('');
        setDescription('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not delete icon.';
      if (/unauthorized|sign in again/i.test(message)) {
        setToken(null);
        setPhase('password');
      }
      setError(message);
    } finally {
      setBusy(false);
      setActiveFileName(null);
    }
  };

  const showLibrary = configured && phase !== 'password';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
      }}
    >
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          'max-h-[90vh] max-w-xl overflow-y-auto border-2 border-violet-400 bg-violet-50 text-violet-950 shadow-xl',
          'dark:border-violet-500 dark:bg-violet-950/95 dark:text-violet-50',
        )}
      >
        <button
          type="button"
          onClick={handleClose}
          className={cn(
            'absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity',
            'hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'text-violet-800 dark:text-violet-200',
          )}
          aria-label="Close icon maintenance"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Icon maintenance
          </DialogTitle>
          <DialogDescription className="text-violet-900/85 dark:text-violet-100/85">
            Generate new SVG icons with a local Ollama model and add them to DiagramWeaver
            resources.
          </DialogDescription>
        </DialogHeader>

        {showLibrary && (
          <LlmIconLibrary
            icons={savedIcons}
            loading={iconsLoading}
            busy={busy}
            activeFileName={activeFileName}
            iconsRevision={iconsRevision}
            onDelete={handleDeleteIcon}
            onRecreate={handleRecreateIcon}
          />
        )}

        {!configured ? (
          <div className="space-y-3 py-2 text-sm">
            <p>
              Maintenance is not configured. Add to <code className="text-xs">.env.local</code>:
            </p>
            <pre className="overflow-x-auto rounded-md bg-violet-100/80 p-3 text-xs dark:bg-violet-900/50">
              {`NEXT_PUBLIC_MAINTENANCE_API_URL=http://127.0.0.1:9005
MAINTENANCE_PASSWORD=your-secret
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2`}
            </pre>
            <p>
              Then run <code className="text-xs">npm run maintenance:server</code> alongside{' '}
              <code className="text-xs">npm run dev</code>.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : phase === 'password' ? (
          <form onSubmit={handlePasswordSubmit} className="space-y-4 py-2">
            {serverInfo && (
              <p className="text-xs text-violet-800/80 dark:text-violet-200/75">
                Server: {apiUrl}
                {serverInfo.model ? ` · model ${serverInfo.model}` : ''}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="maintenance-password">Maintenance password</Label>
              <Input
                id="maintenance-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={busy}
                placeholder="Enter password from .env.local"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button type="submit" disabled={busy || !password.trim()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Unlock
              </Button>
            </DialogFooter>
          </form>
        ) : phase === 'generate' ? (
          <form onSubmit={handleGenerate} className="space-y-4 py-2">
            {replaceMode && replaceFileName ? (
              <p className="rounded-md border border-violet-300/80 bg-violet-100/70 px-3 py-2 text-xs text-violet-900 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-100">
                Recreating <strong>{name}</strong> — confirm will replace{' '}
                <code className="font-mono">{replaceFileName}</code>.
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="icon-name">Icon name</Label>
              <Input
                id="icon-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy}
                placeholder="e.g. API Gateway"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icon-description">Description</Label>
              <Textarea
                id="icon-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
                rows={4}
                placeholder="Describe the icon you want — style, shapes, meaning…"
              />
            </div>
            <p className="text-xs text-violet-800/75 dark:text-violet-200/70">
              Review the preview before confirming. Nothing is saved until you confirm.
            </p>
            {statusMessage && (
              <p className="flex items-center gap-2 text-sm text-violet-800 dark:text-violet-200">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {statusMessage}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button type="submit" disabled={busy || !name.trim() || !description.trim()}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Generate icon
              </Button>
            </DialogFooter>
          </form>
        ) : phase === 'review' ? (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium text-violet-950 dark:text-violet-50">
              Preview: {name}
              {generateAttempt > 1 ? (
                <span className="ml-1 text-xs font-normal text-violet-800/75 dark:text-violet-200/70">
                  (attempt {generateAttempt})
                </span>
              ) : null}
            </p>
            {previewSvg && (
              <div
                className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg border border-violet-300 bg-white p-3 dark:border-violet-700 dark:bg-violet-900/40"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            )}
            <p className="text-xs text-violet-800/75 dark:text-violet-200/70">
              {replaceMode
                ? 'Review the new preview before replacing the saved icon.'
                : 'Review the preview before confirming. Nothing is saved until you confirm.'}
            </p>
            {statusMessage && (
              <p className="flex items-center gap-2 text-sm text-violet-800 dark:text-violet-200">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                {statusMessage}
              </p>
            )}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                {error}
              </p>
            )}
            <DialogFooter className="flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={busy}>
                Close
              </Button>
              <Button type="button" variant="outline" onClick={handleBackToForm} disabled={busy}>
                Edit prompt
              </Button>
              <Button type="button" variant="outline" onClick={handleRetry} disabled={busy}>
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Retry
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={busy || !previewSvg}>
                {replaceMode ? 'Replace icon' : 'Confirm'}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm font-medium text-violet-950 dark:text-violet-50">
              {replaceMode ? `${lastResult?.name} updated` : `${lastResult?.name} added successfully`}
            </p>
            {previewSvg && (
              <div
                className="mx-auto flex h-32 w-32 items-center justify-center rounded-lg border border-violet-300 bg-white p-3 dark:border-violet-700 dark:bg-violet-900/40"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
            )}
            {lastResult && (
              <dl className="space-y-1 text-xs text-violet-900/90 dark:text-violet-100/90">
                <div>
                  <dt className="inline font-semibold">Type: </dt>
                  <dd className="inline font-mono">{lastResult.resourceType}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold">Path: </dt>
                  <dd className="inline font-mono">{lastResult.publicPath}</dd>
                </div>
              </dl>
            )}
            <p className="text-xs text-violet-800/75 dark:text-violet-200/70">
              Reload the resource palette or refresh the page to pick the new icon from Generic →
              LLM Generated.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button type="button" onClick={handleCreateAnother}>
                Create another
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
