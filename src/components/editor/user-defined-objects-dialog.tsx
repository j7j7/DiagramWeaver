"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Trash2 } from 'lucide-react';
import type { UserDefinedObject } from '@/lib/types';

interface UserDefinedObjectsManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objects: UserDefinedObject[];
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onEdit: (object: UserDefinedObject) => void;
}

export function UserDefinedObjectsManageDialog({
  open,
  onOpenChange,
  objects,
  onRename,
  onDelete,
  onEdit,
}: UserDefinedObjectsManageDialogProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const startRename = (obj: UserDefinedObject) => {
    setRenamingId(obj.id);
    setRenameValue(obj.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      onRename(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>User-defined objects</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[360px] pr-3">
          {objects.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No user-defined objects yet. Group items on the canvas, then use Edit → Create user-defined object.
            </p>
          ) : (
            <ul className="space-y-2">
              {objects.map((obj) => (
                <li
                  key={obj.id}
                  className="flex items-center gap-2 rounded-md border p-2"
                >
                  <span
                    className="shrink-0 inline-flex [&_svg]:w-8 [&_svg]:h-8"
                    dangerouslySetInnerHTML={{ __html: obj.iconSvg }}
                  />
                  <div className="flex-1 min-w-0">
                    {renamingId === obj.id ? (
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        autoFocus
                        className="h-8"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-sm font-medium truncate text-left w-full hover:underline"
                        onClick={() => startRename(obj)}
                        title="Click to rename"
                      >
                        {obj.name}
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{obj.id}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => onEdit(obj)}
                    title="Edit in new tab"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => onDelete(obj.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CreateUserDefinedObjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  onConfirm: (name: string) => void;
}

export function CreateUserDefinedObjectDialog({
  open,
  onOpenChange,
  defaultName = '',
  onConfirm,
}: CreateUserDefinedObjectDialogProps) {
  const [name, setName] = useState(defaultName);

  React.useEffect(() => {
    if (open) setName(defaultName);
  }, [open, defaultName]);

  const handleConfirm = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create user-defined object</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="udo-name">Name</Label>
          <Input
            id="udo-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My custom shape"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirm();
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
