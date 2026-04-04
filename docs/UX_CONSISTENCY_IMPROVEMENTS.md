# UX Consistency Improvements Plan

**Date**: 2026-04-04
**Status**: Draft
**Scope**: Comprehensive UX consistency audit and improvement plan for DiagramWeaver

---

## Executive Summary

This document outlines UX inconsistencies identified across the DiagramWeaver interface and proposes standardized design patterns. The analysis reveals issues with button styles, icon usage, panel layouts, dropdown behaviors, keyboard shortcuts, color schemes, typography, and naming conventions. Implementation of these improvements will create a more cohesive and professional user experience.

---

## 1. Button Styles and Icons

### 1.1 Inconsistent Button Variants and Sizes

**Problem**: Different parts of the application use different button variants and sizes without clear patterns.

**Locations**:
- `src/components/ui/button.tsx` - Button component definition
- `src/components/editor/top-menu-bar.tsx` - Top menu buttons
- `src/components/editor/context-toolbar.tsx` - Context toolbar buttons
- `src/components/editor/resource-browser.tsx` - Resource browser buttons

**Current Implementation Examples**:

**Inconsistent usage in top-menu-bar.tsx (lines 500-700)**:
```tsx
// Some buttons use variant="ghost"
<Button variant="ghost" size="sm">...</Button>

// Some buttons use variant="outline"
<Button variant="outline" size="sm">...</Button>

// Some buttons have no variant (default)
<Button size="icon">...</Button>

// Icon buttons sometimes use h-4 w-4, sometimes h-5 w-5
<Copy className="h-4 w-4" />
<Paste className="h-5 w-5" />
```

**Inconsistent usage in context-toolbar.tsx (lines 400-800)**:
```tsx
// Some buttons have icons, some don't
<Button onClick={handleDelete}><Trash2 className="h-4 w-4 mr-2" />Delete</Button>
<Button onClick={handleCopy}>Copy</Button>

// Inconsistent icon sizes
<Type className="h-4 w-4" />
<AlignLeft className="h-5 w-5" />
```

**Proposed Solution**:
Create a standardized button usage guide:

```typescript
// DESIGN SYSTEM: Button Usage Patterns

// 1. Primary Actions (Create, Save, Export)
<Button variant="default" size="default">
  <Icon className="h-4 w-4 mr-2" />
  Label
</Button>

// 2. Secondary Actions (Cancel, Close)
<Button variant="outline" size="default">
  <Icon className="h-4 w-4 mr-2" />
  Label
</Button>

// 3. Destructive Actions (Delete, Remove)
<Button variant="destructive" size="default">
  <Icon className="h-4 w-4 mr-2" />
  Label
</Button>

// 4. Toolbar Buttons (with icon, no text, smaller)
<Button variant="ghost" size="icon" className="h-8 w-8">
  <Icon className="h-4 w-4" />
</Button>

// 5. Toolbar Toggle Buttons (active state)
<Button
  variant={isActive ? "secondary" : "ghost"}
  size="icon"
  className="h-8 w-8"
>
  <Icon className="h-4 w-4" />
</Button>

// 6. Menu Item Buttons
<Button variant="ghost" size="sm" className="justify-start w-full">
  <Icon className="h-4 w-4 mr-2" />
  Label
</Button>
```

**Before/After Examples**:

**Before (inconsistent)**:
```tsx
// Mixed sizes and variants
<Button className="h-9 px-3"><Copy className="h-4 w-4" /></Button>
<Button variant="ghost"><Paste className="h-5 w-5" /></Button>
<Button variant="outline" size="sm"><Delete className="h-3 w-3" /> Delete</Button>
```

**After (consistent)**:
```tsx
// All toolbar buttons: ghost variant, icon size, h-8 w-8
<Button variant="ghost" size="icon" className="h-8 w-8">
  <Copy className="h-4 w-4" />
</Button>
<Button variant="ghost" size="icon" className="h-8 w-8">
  <Paste className="h-4 w-4" />
</Button>
// Destructive action: destructive variant
<Button variant="destructive" size="sm">
  <Trash2 className="h-4 w-4 mr-2" />
  Delete
</Button>
```

**Implementation Priority**: High
**Estimated Effort**: 2-3 days (audit + fixes across all components)

---

### 1.2 Inconsistent Icon Usage

**Problem**: Similar actions sometimes use different icons, or icons are used inconsistently across the UI.

**Locations**: Multiple component files

**Current Examples**:

**Inconsistent close icons**:
```tsx
// top-menu-bar.tsx uses X
<X className="h-4 w-4" />

// Some dialogs use X
<X className="h-4 w-4" />

// Some popovers use X
<X className="h-4 w-4" />

// But some use different close icons (if any)
```

**Inconsistent settings/preferences icons**:
```tsx
// Some places use Settings icon
<Settings className="h-4 w-4" />

// Some places use Gear icon
<Gear className="h-4 w-4" />

// Some places use Cog icon
<Cog className="h-4 w-4" />
```

**Proposed Solution**:
Create an icon mapping document:

```typescript
// ICON STANDARDIZATION DOCUMENT

// File Operations
New: <Plus /> or <FilePlus />
Open/Load: <Upload /> or <FolderOpen />
Save: <Save /> or <Download />
Export: <Download />
Import: <Upload />

// Edit Operations
Undo: <Undo />
Redo: <Redo />
Copy: <Copy />
Paste: <Clipboard />
Cut: <Scissors />
Delete: <Trash2 /> (always Trash2, not Trash)
Duplicate: <Copy /> (or <Duplicate /> if available)

// View Operations
Zoom In: <ZoomIn /> or <Plus />
Zoom Out: <ZoomOut /> or <Minus />
Fit to View: <Maximize2 /> or <Expand />
Pan: <Move /> or <Hand />

// Selection
Select All: <CheckSquare />
Deselect All: <Square />
Multi-select: <CheckSquare />

// Styling
Text Style: <Type />
Font Family: <Type />
Font Size: <TextHeight /> or <Heading />
Bold: <Bold />
Italic: <Italic />
Underline: <Underline />

// Alignment
Align Left: <AlignLeft />
Align Center: <AlignCenter />
Align Right: <AlignRight />
Align Top: <AlignVerticalJustifyStart />
Align Middle: <AlignVerticalJustifyCenter />
Align Bottom: <AlignVerticalJustifyEnd />

// Colors
Fill Color: <Palette /> or <Bucket />
Stroke Color: <Pencil /> or <PenTool />
Background: <Palette />

// Layers/Ordering
Bring to Front: <ArrowUp /> or <MoveUp />
Send to Back: <ArrowDown /> or <MoveDown />

// Groups
Group: <Group /> or <Layers />
Ungroup: <Ungroup /> or <Layers /> with different style
Add to Group: <Plus /> + <Layers />
Remove from Group: <Minus /> + <Layers />

// Connections
Connect: <Link /> or <Plug />
Disconnect: <Unlink /> or <PlugX />
Add Waypoint: <Plus />

// Panels/Windows
Close: <X />
Minimize: <Minus />
Maximize: <Maximize2 />
Expand/Collapse: <ChevronDown /> / <ChevronRight />

// Settings/Preferences
Settings: <Settings /> (standardize on this one)
Preferences: <Settings />

// Help/Info
Help: <HelpCircle /> or <BookOpen />
About: <Info />
Keyboard Shortcuts: <Keyboard />
Documentation: <BookOpen />

// Menus
Menu: <Menu /> or <MoreHorizontal />

// Search/Filter
Search: <Search />
Filter: <Filter />

// Common Actions
Confirm/OK: <Check />
Cancel: <X />
Apply: <Check />

// State Indicators
Success: <CheckCircle />
Error: <XCircle />
Warning: <AlertTriangle />
Info: <Info />
Loading: <Loader2 /> (with spin animation)
```

**Implementation Priority**: High
**Estimated Effort**: 1-2 days

---

## 2. Panel Layouts and Spacing

### 2.1 Inconsistent Panel Padding and Margins

**Problem**: Different panels use different padding values, creating visual inconsistency.

**Locations**:
- `src/components/editor/properties-panel.tsx`
- `src/components/editor/layers-panel.tsx`
- `src/components/editor/json-editor-panel.tsx`
- `src/components/editor/text-styling-panel.tsx`
- `src/components/editor/visual-styling-panel.tsx`

**Current Examples**:

**properties-panel.tsx** (various lines):
```tsx
// Some sections use p-4
<div className="p-4">...</div>

// Some sections use p-3
<div className="p-3">...</div>

// Some sections use px-4 py-2
<div className="px-4 py-2">...</div>

// Inconsistent spacing between elements
<div className="space-y-2">...</div>
<div className="space-y-4">...</div>
<div className="gap-2">...</div>
<div className="gap-4">...</div>
```

**Proposed Solution**:
Standardize panel spacing:

```typescript
// PANEL SPACING STANDARD

// 1. Panel Container
<div className="h-full flex flex-col bg-background border-l">
  {/* Panel Header */}
  <div className="px-4 py-3 border-b">
    <h3 className="font-semibold text-sm">Panel Title</h3>
  </div>

  {/* Panel Content */}
  <div className="flex-1 overflow-y-auto p-4">
    {/* Content sections */}
  </div>
</div>

// 2. Section Grouping
<div className="space-y-4">
  {/* Each section */}
</div>

// 3. Section Header
<div className="flex items-center justify-between mb-2">
  <h4 className="text-xs font-medium uppercase text-muted-foreground">
    Section Title
  </h4>
  {/* Optional action button */}
</div>

// 4. Section Content
<div className="space-y-2">
  {/* Items */}
</div>

// 5. Form Row (label + control)
<div className="flex items-center justify-between">
  <Label className="text-sm">Label</Label>
  <Control className="ml-2" />
</div>

// OR stacked:

<div className="space-y-1">
  <Label className="text-sm">Label</Label>
  <Control />
</div>

// 6. Group of related controls
<div className="flex items-center gap-2">
  <Control />
  <Control />
  <Control />
</div>

// 7. Divider between sections
<Separator className="my-4" />
```

**Before/After Examples**:

**Before (inconsistent)**:
```tsx
<div className="p-3 space-y-2">
  <div className="mb-2">
    <h4 className="font-medium">Position</h4>
  </div>
  <div className="gap-2 flex">
    <Input />
    <Input />
  </div>
</div>
<div className="px-4 py-2 space-y-4">
  <div>
    <Label>Size</Label>
    <div className="mt-1 flex gap-3">
      <Input />
      <Input />
    </div>
  </div>
</div>
```

**After (consistent)**:
```tsx
<div className="space-y-4">
  {/* Position Section */}
  <div>
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">
        Position
      </h4>
    </div>
    <div className="flex items-center gap-2">
      <Input />
      <Input />
    </div>
  </div>

  <Separator />

  {/* Size Section */}
  <div>
    <div className="flex items-center justify-between mb-2">
      <h4 className="text-xs font-medium uppercase text-muted-foreground">
        Size
      </h4>
    </div>
    <div className="flex items-center gap-2">
      <Input />
      <Input />
    </div>
  </div>
</div>
```

**Implementation Priority**: High
**Estimated Effort**: 2-3 days

---

### 2.2 Inconsistent Panel Header Styles

**Problem**: Panel headers have different styles, icons, and close button positions.

**Current Examples**:

**properties-panel.tsx**:
```tsx
<div className="px-4 py-3 border-b flex items-center justify-between">
  <h3 className="font-semibold">Properties</h3>
  <Button variant="ghost" size="icon" className="h-6 w-6">
    <X className="h-4 w-4" />
  </Button>
</div>
```

**layers-panel.tsx**:
```tsx
<div className="px-4 py-2 border-b">
  <h3 className="font-semibold text-sm">Layers</h3>
</div>
```

**json-editor-panel.tsx**:
```tsx
<div className="px-4 py-2 border-b flex items-center gap-2">
  <Code className="h-4 w-4" />
  <span className="font-semibold text-sm">JSON Editor</span>
</div>
```

**Proposed Solution**:
Standardize panel header pattern:

```typescript
// PANEL HEADER STANDARD

// Option A: With close button
<div className="px-4 py-3 border-b flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h3 className="font-semibold text-sm">Panel Title</h3>
  </div>
  <Button
    variant="ghost"
    size="icon"
    className="h-7 w-7"
    onClick={onClose}
  >
    <X className="h-4 w-4" />
  </Button>
</div>

// Option B: Without close button (if panel is always visible)
<div className="px-4 py-3 border-b">
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h3 className="font-semibold text-sm">Panel Title</h3>
  </div>
</div>

// Option C: With action button (not close)
<div className="px-4 py-3 border-b flex items-center justify-between">
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h3 className="font-semibold text-sm">Panel Title</h3>
  </div>
  <Button variant="ghost" size="sm">
    <Plus className="h-4 w-4 mr-1" />
    Add
  </Button>
</div>
```

**Implementation Priority**: Medium
**Estimated Effort**: 1-2 days

---

## 3. Dropdown and Popover Behaviors

### 3.1 Inconsistent Popover Trigger Styles

**Problem**: Popovers are triggered with different button styles (some ghost, some outline, some default).

**Locations**: Multiple components using Popover from `@/components/ui/popover`

**Current Examples**:

**context-toolbar.tsx** (lines 500-800):
```tsx
// Some popovers use ghost buttons
<Popover>
  <PopoverTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8">
      <Type className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent>...</PopoverContent>
</Popover>

// Some use icon buttons without variant
<Popover>
  <PopoverTrigger asChild>
    <Button size="icon" className="h-8 w-8">
      <Palette className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent>...</PopoverContent>
</Popover>

// Inconsistent active states
<Button variant={textStylingOpen ? "secondary" : "ghost"}>
  <Type className="h-4 w-4" />
</Button>
```

**Proposed Solution**:
Standardize popover trigger pattern:

```typescript
// POPOVER TRIGGER STANDARD

// 1. Toolbar Popover (icon only)
<Popover open={isOpen} onOpenChange={setIsOpen}>
  <PopoverTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8",
        isOpen && "bg-accent"
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" side="bottom" className="w-64">
    {/* Content */}
  </PopoverContent>
</Popover>

// 2. Text Label Popover
<Popover open={isOpen} onOpenChange={setIsOpen}>
  <PopoverTrigger asChild>
    <Button
      variant={isOpen ? "secondary" : "ghost"}
      size="sm"
      className="justify-start"
    >
      <Icon className="h-4 w-4 mr-2" />
      Label
      <ChevronDown className="h-4 w-4 ml-auto" />
    </Button>
  </PopoverTrigger>
  <PopoverContent align="start" side="bottom" className="w-64">
    {/* Content */}
  </PopoverContent>
</Popover>

// 3. Split Button with Popover (main action + dropdown)
<div className="flex">
  <Button onClick={handleAction}>
    <Icon className="h-4 w-4 mr-2" />
    Action
  </Button>
  <Popover>
    <PopoverTrigger asChild>
      <Button variant="outline" className="border-l-0 rounded-l-none">
        <ChevronDown className="h-4 w-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end">
      {/* Dropdown options */}
    </PopoverContent>
  </Popover>
</div>
```

**Implementation Priority**: High
**Estimated Effort**: 1-2 days

---

### 3.2 Inconsistent Popover Content Padding and Layout

**Problem**: Popover content has different padding and internal layouts.

**Current Examples**:

**Some popovers use p-4**:
```tsx
<PopoverContent className="p-4">
  <div className="space-y-3">...</div>
</PopoverContent>
```

**Some use p-3**:
```tsx
<PopoverContent className="p-3">
  <div className="space-y-2">...</div>
</PopoverContent>
```

**Some have no explicit padding**:
```tsx
<PopoverContent>
  <div className="p-4">...</div>
</PopoverContent>
```

**Proposed Solution**:
Standardize popover content:

```typescript
// POPOVER CONTENT STANDARD

// 1. Standard Content
<PopoverContent className="w-64 p-4">
  <div className="space-y-4">
    {/* Content sections */}
  </div>
</PopoverContent>

// 2. Content with Header
<PopoverContent className="w-80 p-0">
  <div className="px-4 py-3 border-b">
    <h4 className="font-semibold text-sm">Title</h4>
  </div>
  <div className="p-4 space-y-4">
    {/* Content */}
  </div>
  {/* Optional footer */}
  <div className="px-4 py-3 border-t bg-muted/50">
    <Button className="w-full">Action</Button>
  </div>
</PopoverContent>

// 3. Compact List Content (for color pickers, etc.)
<PopoverContent className="w-48 p-2">
  <div className="grid grid-cols-4 gap-2">
    {/* Grid items */}
  </div>
</PopoverContent>
```

**Implementation Priority**: Medium
**Estimated Effort**: 1 day

---

### 3.3 Inconsistent Dropdown Menus

**Problem**: DropdownMenu components have different item styles and separators.

**Locations**: `top-menu-bar.tsx`, `context-toolbar.tsx`

**Current Examples**:

**Some menu items have shortcuts**:
```tsx
<MenubarItem onClick={onSave}>
  Save
  <MenubarShortcut>⌘S</MenubarShortcut>
</MenubarItem>
```

**Some don't**:
```tsx
<MenubarItem onClick={onDelete}>Delete</MenubarItem>
```

**Inconsistent icon usage**:
```tsx
<MenubarItem>
  <Copy className="mr-2 h-4 w-4" />
  Copy
</MenubarItem>
<MenubarItem>
  Paste {/* No icon! */}
</MenubarItem>
```

**Proposed Solution**:
Standardize dropdown menu items:

```typescript
// DROPDOWN MENU ITEM STANDARD

// 1. Standard Item with Icon
<DropdownMenuItem>
  <Icon className="mr-2 h-4 w-4" />
  Label
  {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
</DropdownMenuItem>

// 2. Item without Icon (when icon doesn't add value)
<DropdownMenuItem>
  Label
  {shortcut && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
</DropdownMenuItem>

// 3. Destructive Item
<DropdownMenuItem className="text-destructive focus:text-destructive">
  <Trash2 className="mr-2 h-4 w-4" />
  Delete
</DropdownMenuItem>

// 4. Item with Submenu
<DropdownMenuSub>
  <DropdownMenuSubTrigger>
    <Icon className="mr-2 h-4 w-4" />
    Submenu Label
    <ChevronRight className="ml-auto h-4 w-4" />
  </DropdownMenuSubTrigger>
  <DropdownMenuSubContent>
    {/* Submenu items */}
  </DropdownMenuSubContent>
</DropdownMenuSub>

// 5. Checkbox Item
<DropdownMenuItem>
  <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
  Label
</DropdownMenuItem>

// 6. Separator
<DropdownMenuSeparator />

// 7. Grouped Items
<DropdownMenuGroup>
  <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
    Group Label
  </DropdownMenuLabel>
  {/* Items */}
</DropdownMenuGroup>
```

**Implementation Priority**: High
**Estimated Effort**: 1-2 days

---

## 4. Keyboard Shortcuts and Accessibility

### 4.1 Inconsistent Keyboard Shortcuts

**Problem**: Similar actions have different shortcuts across the app, or some actions lack shortcuts.

**Current Examples**:

From code inspection:
- Save: Cmd/Ctrl+S (good)
- Undo: Cmd/Ctrl+Z (good)
- Redo: Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y (inconsistent)
- Copy: Cmd/Ctrl+C (good)
- Paste: Cmd/Ctrl+V (good)
- Delete: Delete or Backspace (inconsistent)
- Select All: Cmd/Ctrl+A (good)

**Missing shortcuts**:
- No shortcut for "Fit to View"
- No shortcut for "Zoom In/Out"
- No shortcut for "Toggle Grid"
- No shortcut for "Toggle Snap"
- No shortcut for "Toggle Panels"
- No shortcut for "New Diagram"

**Proposed Solution**:
Create a comprehensive keyboard shortcuts standard:

```typescript
// KEYBOARD SHORTCUTS STANDARD

// File Operations
New Diagram: Cmd/Ctrl + N
Open Diagram: Cmd/Ctrl + O
Save Diagram: Cmd/Ctrl + S
Save As: Cmd/Ctrl + Shift + S
Export PNG: Cmd/Ctrl + E
Export GIF: Cmd/Ctrl + Shift + E

// Edit Operations
Undo: Cmd/Ctrl + Z
Redo: Cmd/Ctrl + Shift + Z (or Cmd/Ctrl + Y)
Cut: Cmd/Ctrl + X
Copy: Cmd/Ctrl + C
Paste: Cmd/Ctrl + V
Delete: Delete or Backspace
Duplicate: Cmd/Ctrl + D
Select All: Cmd/Ctrl + A
Deselect All: Cmd/Ctrl + Shift + A (or Escape)

// View Operations
Zoom In: Cmd/Ctrl + + (or Cmd/Ctrl + =)
Zoom Out: Cmd/Ctrl + -
Zoom to 100%: Cmd/Ctrl + 0
Fit to View: Cmd/Ctrl + 1 (or Cmd/Ctrl + F)
Toggle Grid: Cmd/Ctrl + G
Toggle Snap: Cmd/Ctrl + Shift + G
Toggle Rulers: Cmd/Ctrl + R

// Navigation
Pan: Space + Drag (or Middle Mouse)
Scroll to Selection: .

// Node Operations
Add Node: N
Add Text: T
Add Connection: C
Group Selection: Cmd/Ctrl + G
Ungroup: Cmd/Ctrl + Shift + G
Bring to Front: ]
Send to Back: [

// Panel Toggles
Toggle Properties Panel: Cmd/Ctrl + P
Toggle Layers Panel: Cmd/Ctrl + L
Toggle JSON Editor: Cmd/Ctrl + J
Toggle Resource Browser: Cmd/Ctrl + B
Toggle All Panels: Cmd/Ctrl + \

// Other
Toggle Dark/Light Mode: Cmd/Ctrl + Shift + T
Show Keyboard Shortcuts: ?
Show Help: F1
Close Dialog/Panel: Escape

// Browser Standards (should work automatically)
Find: Cmd/Ctrl + F
Print: Cmd/Ctrl + P (should not conflict if handled carefully)
```

**Implementation Priority**: High
**Estimated Effort**: 2-3 days (implement + update UI documentation)

---

### 4.2 Missing ARIA Labels and Roles

**Problem**: Some interactive elements lack proper ARIA labels, making them inaccessible to screen readers.

**Current Examples**:

**Icon-only buttons without aria-label**:
```tsx
<Button variant="ghost" size="icon">
  <Copy className="h-4 w-4" />
  {/* Missing aria-label! */}
</Button>
```

**Custom interactive elements without role**:
```tsx
<div onClick={handleAction} className="cursor-pointer">
  {/* Missing role="button" and keyboard support */}
  Click me
</div>
```

**Proposed Solution**:
Add accessibility attributes:

```typescript
// ACCESSIBILITY STANDARD

// 1. Icon-only buttons MUST have aria-label
<Button
  variant="ghost"
  size="icon"
  aria-label="Copy selection"
  onClick={handleCopy}
>
  <Copy className="h-4 w-4" />
</Button>

// 2. Toggle buttons should indicate state
<Button
  variant="ghost"
  size="icon"
  aria-label={isVisible ? "Hide grid" : "Show grid"}
  aria-pressed={isVisible}
  onClick={toggleGrid}
>
  <Grid3x3 className="h-4 w-4" />
</Button>

// 3. Custom clickable elements should be buttons or have proper role
// Option A: Use <button> element
<button
  onClick={handleAction}
  className="cursor-pointer"
  type="button"
>
  Click me
</button>

// Option B: Use div with role and keyboard support
<div
  role="button"
  tabIndex={0}
  onClick={handleAction}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAction();
    }
  }}
  className="cursor-pointer"
>
  Click me
</div>

// 4. Live regions for dynamic content
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {statusMessage}
</div>

// 5. Form labels should be associated with inputs
<Label htmlFor="node-width">Width</Label>
<Input id="node-width" type="number" />

// 6. Descriptive labels for icon-only tools
<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      aria-label="Select tool"
    >
      <MousePointer2 className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Select Tool (V)</p>
  </TooltipContent>
</Tooltip>

// 7. Focus management for dialogs
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent
    onOpenAutoFocus={(e) => {
      // Focus first interactive element
      e.preventDefault();
      firstInputRef.current?.focus();
    }}
    onCloseAutoFocus={(e) => {
      // Return focus to trigger
      e.preventDefault();
      triggerRef.current?.focus();
    }}
  >
    {/* Content */}
  </DialogContent>
</Dialog>
```

**Implementation Priority**: High (accessibility is critical)
**Estimated Effort**: 2-3 days

---

## 5. Color Schemes and Typography

### 5.1 Inconsistent Color Usage for Similar Actions

**Problem**: Similar actions use different colors across the UI.

**Current Examples**:

**Delete actions**:
- Some use red/destructive variant
- Some use ghost/outline variant
- Some use different red shades

**Selected state indicators**:
- Some use blue background
- Some use accent background
- Some use ring/border

**Proposed Solution**:
Standardize color usage:

```typescript
// COLOR USAGE STANDARD

// 1. Primary Actions (confirm, save, apply)
<Button variant="default">Save</Button> // Uses primary color (blue in light, custom in dark)

// 2. Secondary Actions (cancel, close)
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Close</Button>

// 3. Destructive Actions (delete, remove, clear)
<Button variant="destructive">Delete</Button> // Always use destructive variant
<Button variant="outline" className="text-destructive hover:text-destructive">
  Remove
</Button>

// 4. Selected State
// For buttons:
<Button variant="secondary" className="bg-accent">
  Selected
</Button>

// For items in lists:
<div className="bg-accent text-accent-foreground">
  Selected Item
</div>

// For visual selection (nodes, etc.):
// Use ring/border instead of background to preserve content
<div className="ring-2 ring-primary ring-offset-2">
  Selected Content
</div>

// 5. Status Colors
// Success: text-green-600 or bg-green-500/10
// Error: text-red-600 or bg-red-500/10
// Warning: text-yellow-600 or bg-yellow-500/10
// Info: text-blue-600 or bg-blue-500/10

// 6. Connection Colors
// Follow semantic meaning, not random colors
// Data flow: blue/indigo
// Control flow: green/teal
// Error flow: red
// Default: gray/muted

// 7. Provider Brand Colors (from resource-browser.tsx)
// These are already well-defined, keep them:
// AWS: orange-500
// Azure: blue-500
// GCP: green-500
// etc.

// 8. Dark Mode Colors
// Ensure all colors work in both light and dark mode
// Use CSS variables or Tailwind's dark: prefix
<div className="bg-background text-foreground dark:bg-background dark:text-foreground">
```

**Implementation Priority**: Medium
**Estimated Effort**: 2-3 days

---

### 5.2 Inconsistent Typography

**Problem**: Text sizes, weights, and line heights vary inconsistently across the UI.

**Current Examples**:

**Panel titles**:
- Some use `font-semibold` (600 weight)
- Some use `font-bold` (700 weight)
- Some use `text-sm`, some `text-base`

**Section headers**:
- Some use `text-xs font-medium uppercase text-muted-foreground`
- Some use `text-sm font-semibold`
- Some use `text-xs font-bold uppercase`

**Labels**:
- Some use `text-sm`
- Some use `text-xs`
- Some have explicit font weights, some don't

**Proposed Solution**:
Standardize typography scale:

```typescript
// TYPOGRAPHY STANDARD

// 1. Hierarchy
// H1 - Page/View Title (rarely used in app)
text-2xl font-bold tracking-tight

// H2 - Section Title (used in dialogs, main sections)
text-xl font-semibold tracking-tight

// H3 - Panel/Block Title
text-base font-semibold

// H4 - Section Header within panel
text-xs font-medium uppercase text-muted-foreground

// Body - Default text
text-sm

// Small - Secondary text, hints
text-xs text-muted-foreground

// 2. Component-Specific Typography

// Panel Title
<h3 className="text-base font-semibold">Properties</h3>

// Panel Section Header
<h4 className="text-xs font-medium uppercase text-muted-foreground mb-2">
  Position
</h4>

// Form Label
<Label className="text-sm font-medium">Width</Label>

// Button Text
text-sm font-medium (default for Button component)

// Menu Item
text-sm

// Tooltip/Popover Content
text-sm

// Code/Mono
font-mono text-xs

// 3. Text Utilities

// Truncate long text
truncate-text-overflow

// Line clamping
line-clamp-2
line-clamp-3

// 4. Spacing
// Line height for readability
leading-relaxed (for long text)
leading-normal (for UI text)

// Letter spacing for uppercase text
tracking-wider (for uppercase headers)
```

**Before/After Examples**:

**Before (inconsistent)**:
```tsx
<h3 className="font-bold text-lg">Properties</h3>
<h4 className="font-semibold">Position</h4>
<Label className="text-xs">Width</Label>
<Button className="font-normal">Save</Button>
```

**After (consistent)**:
```tsx
<h3 className="text-base font-semibold">Properties</h3>
<h4 className="text-xs font-medium uppercase text-muted-foreground">
  Position
</h4>
<Label className="text-sm font-medium">Width</Label>
<Button className="text-sm font-medium">Save</Button>
```

**Implementation Priority**: Medium
**Estimated Effort**: 2-3 days

---

## 6. Naming Conventions

### 6.1 Inconsistent Component and Prop Naming

**Problem**: Similar concepts have different names across components.

**Current Examples**:

**Open/closed state**:
- `isOpen`, `open`, `visible`, `show`, `expanded`
- `onClose`, `onToggle`, `onOpenChange`

**Selected state**:
- `selected`, `isSelected`, `active`, `isActive`

**Size/width/height**:
- `width`, `w`, `size`, `dimensions`

**Proposed Solution**:
Standardize naming conventions:

```typescript
// NAMING CONVENTIONS STANDARD

// 1. Boolean State Props
// Use is/has/should prefix for clarity
isOpen: boolean
isVisible: boolean
isSelected: boolean
isDisabled: boolean
isLoading: boolean
isReadOnly: boolean
hasError: boolean
shouldShow: boolean

// 2. Event Handler Props
// Use on[Action] pattern
onClick: () => void
onChange: (value: T) => void
onOpenChange: (open: boolean) => void
onClose: () => void
onToggle: () => void
onSelect: (item: T) => void
onUpdate: (item: T) => void
onDelete: (id: string) => void

// 3. Size Props
// Use explicit names
width: number
height: number
size: 'sm' | 'md' | 'lg'
minWidth: number
maxWidth: number

// 4. Position Props
x: number
y: number
position: { x: number; y: number }

// 5. List/Array Props
// Use plural form
items: T[]
nodes: Node[]
connections: Connection[]
options: Option[]

// 6. ID Props
// Use singular form
id: string
nodeId: string
connectionId: string

// 7. Data Props
// Use descriptive names
diagramData: DiagramData
nodeData: NodeData
connectionData: ConnectionData

// 8. Style Props
// Group related styles
className?: string
style?: React.CSSProperties

// 9. Component Names
// Use PascalCase, descriptive
DiagramNode (not Node)
CanvasConnections (not Connections)
PropertiesPanel (not Properties)
JsonEditorPanel (not JsonEditor)

// 10. Hook Names
// Use 'use' prefix
useCanvasSelection
useLayerAnimation
useDiagramTabs

// 11. Utility Functions
// Use verb or adjective
calculateLayout
computeConnectionSlots
snapToGrid
isColorDark
getTextStylingCSS
```

**Implementation Priority**: Low (refactoring existing names has risk)
**Estimated Effort**: 3-5 days (if done comprehensively)

---

### 6.2 Inconsistent Label Text

**Problem**: Similar concepts have different labels in the UI.

**Current Examples**:

**Delete/Remove**:
- Some buttons say "Delete"
- Some say "Remove"
- Some say "Clear"

**Close/Dismiss**:
- Some say "Close"
- Some say "Dismiss"
- Some say "Cancel" (even when not canceling)

**Save/Apply**:
- Some say "Save"
- Some say "Apply"
- Some say "OK"

**Proposed Solution**:
Standardize terminology:

```typescript
// TERMINOLOGY STANDARD

// 1. Destructive Actions
// "Delete" - permanently removes data
// "Remove" - removes from current context but might exist elsewhere
// "Clear" - empties a field or selection without deleting the item

// Examples:
- "Delete Node" (removes from diagram permanently)
- "Remove from Group" (node still exists, just not in group)
- "Clear Selection" (deselects all)

// 2. Confirm/Cancel Actions
// "Save" - persists data
// "Apply" - applies changes without closing
// "OK" - confirms and closes
// "Cancel" - discards changes and closes
// "Close" - closes without confirming/canceling (when no changes)

// Examples:
- Dialog with form: [Cancel] [Save]
- Dialog with preview: [Cancel] [Apply] [OK]
- Informational dialog: [Close] or [OK]

// 3. Open/Close
// "Open" - opens a file, panel, or expands a section
// "Close" - closes a file, panel, or collapses a section
// "Expand" - shows more content
// "Collapse" - shows less content
// "Show" - makes visible
// "Hide" - makes invisible

// Examples:
- "Open File" (loads a diagram)
- "Close Tab" (closes a diagram tab)
- "Expand Section" (shows more options)
- "Show Grid" (makes grid visible)

// 4. Navigation
// "Go to" - navigates to a location
- "Go to Sub-diagram"
- "Go to Parent"

// 5. Actions
// Use clear, active verbs
- "Create" (not "New")
- "Add" (not "Insert")
- "Edit" (not "Modify")
- "Duplicate" (not "Copy" when creating new instance)
- "Import" (not "Load" for files)
- "Export" (not "Save" for exports)

// 6. Status
- "Loading" (not "Please wait" or spinner-only)
- "Success" (not "Done" or "Complete")
- "Error" (not "Failed" or "Problem")
- "Warning" (for cautionary messages)

// 7. Panel/Dialog Titles
// Use noun phrases, title case
- "Properties" (not "Properties Panel")
- "Layers" (not "Layer Manager")
- "Export Diagram" (not "Export")
- "Keyboard Shortcuts" (not "Shortcuts")
```

**Before/After Examples**:

**Before (inconsistent)**:
```tsx
<Button>Remove Node</Button>
<Button onClick={closePanel}>Dismiss</Button>
<Button onClick={applyChanges}>OK</Button>
<Button onClick={deleteSelection}>Clear</Button>
```

**After (consistent)**:
```tsx
<Button>Delete Node</Button>
<Button onClick={closePanel}>Close</Button>
<Button onClick={applyChanges}>Apply</Button>
<Button onClick={deleteSelection}>Delete Selection</Button>
```

**Implementation Priority**: Medium
**Estimated Effort**: 1-2 days

---

## 7. Tooltip and Help Text

### 7.1 Missing Tooltips on Icon-Only Buttons

**Problem**: Many icon-only buttons lack tooltips, making their purpose unclear.

**Current Examples**:

**In toolbar**:
```tsx
<Button variant="ghost" size="icon">
  <Copy className="h-4 w-4" />
  {/* No tooltip! */}
</Button>
```

**Proposed Solution**:
Add tooltips to all icon-only buttons:

```typescript
// TOOLTIP STANDARD

// 1. All icon-only buttons MUST have tooltips
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" aria-label="Copy selection">
      <Copy className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Copy</p>
    <p className="text-xs text-muted-foreground">⌘C</p>
  </TooltipContent>
</Tooltip>

// 2. Show keyboard shortcut in tooltip if available
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Save className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Save Diagram</p>
    <p className="text-xs text-muted-foreground">⌘S</p>
  </TooltipContent>
</Tooltip>

// 3. For complex tools, show brief description
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon">
      <Network className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>Auto Layout</p>
    <p className="text-xs text-muted-foreground">Arrange nodes automatically</p>
  </TooltipContent>
</Tooltip>

// 4. For toggle buttons, show current state
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" aria-pressed={gridEnabled}>
      <Grid3x3 className="h-4 w-4" />
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    <p>{gridEnabled ? "Hide Grid" : "Show Grid"}</p>
    <p className="text-xs text-muted-foreground">⌘G</p>
  </TooltipContent>
</Tooltip>
```

**Implementation Priority**: High
**Estimated Effort**: 2-3 days

---

### 7.2 Inconsistent Help Text and Placeholders

**Problem**: Form fields have inconsistent placeholder text and help text.

**Current Examples**:

**Input placeholders**:
- Some use "Enter value..."
- Some use "Value"
- Some have no placeholder

**Help text**:
- Some use `text-xs text-muted-foreground`
- Some use `text-sm`
- Some use `text-xs`

**Proposed Solution**:
Standardize help text and placeholders:

```typescript
// HELP TEXT AND PLACEHOLDER STANDARD

// 1. Input Placeholders
// Use descriptive, helpful placeholders
<Input placeholder="Enter node label" />
<Input placeholder="https://example.com" />
<Input placeholder="Search resources..." />

// 2. Help Text
// Use small, muted text below inputs
<div className="space-y-1">
  <Label htmlFor="url">URL</Label>
  <Input id="url" placeholder="https://example.com" />
  <p className="text-xs text-muted-foreground">
    Links will open in a new tab
  </p>
</div>

// 3. Error Messages
// Use consistent error styling
<div className="space-y-1">
  <Label htmlFor="email">Email</Label>
  <Input id="email" />
  {error && (
    <p className="text-xs text-destructive">
      {error}
    </p>
  )}
</div>

// 4. Field Groups
// Use consistent spacing
<div className="space-y-4">
  {/* Field 1 */}
  <div className="space-y-1">
    <Label>Label</Label>
    <Input />
    <p className="text-xs text-muted-foreground">Help text</p>
  </div>

  {/* Field 2 */}
  <div className="space-y-1">
    <Label>Label</Label>
    <Input />
    <p className="text-xs text-muted-foreground">Help text</p>
  </div>
</div>
```

**Implementation Priority**: Medium
**Estimated Effort**: 1-2 days

---

## 8. Responsive Design Consistency

### 8.1 Inconsistent Mobile/Tablet Handling

**Problem**: Some panels and dialogs don't handle smaller screens well.

**Current Examples**:

**Panels that don't collapse**:
- Properties panel stays open on mobile
- JSON editor doesn't adapt to small screens

**Dialogs that overflow**:
- Some dialogs are too tall for mobile screens
- Modals don't scroll properly on small screens

**Proposed Solution**:
Implement consistent responsive patterns:

```typescript
// RESPONSIVE DESIGN STANDARD

// 1. Panel Collapse on Mobile
<div className={cn(
  "hidden md:flex",
  "fixed inset-y-0 right-0 z-50 w-80 bg-background border-l shadow-lg",
  "transition-transform",
  isOpen ? "translate-x-0" : "translate-x-full"
)}>
  {/* Panel content */}
</div>

// 2. Responsive Dialogs
<DialogContent className="max-w-[95vw] md:max-w-lg max-h-[90vh] overflow-y-auto">
  {/* Content */}
</DialogContent>

// 3. Responsive Grid
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Items */}
</div>

// 4. Responsive Toolbar
<div className="flex flex-wrap gap-2 md:gap-4">
  {/* Toolbar items */}
</div>

// 5. Responsive Button Groups
<div className="flex flex-col sm:flex-row gap-2">
  <Button className="flex-1">Action 1</Button>
  <Button className="flex-1">Action 2</Button>
</div>

// 6. Responsive Typography
<h1 className="text-xl sm:text-2xl md:text-3xl">Title</h1>
<p className="text-sm sm:text-base">Description</p>

// 7. Hide on Mobile/Show on Desktop
<div className="hidden md:block">
  {/* Desktop-only content */}
</div>

// Show on Mobile/Hide on Desktop
<div className="md:hidden">
  {/* Mobile-only content */}
</div>
```

**Implementation Priority**: Medium
**Estimated Effort**: 3-4 days

---

## Implementation Priority Summary

### Phase 1: Critical UX Issues (1-2 weeks)
1. **Standardize button styles and icons** (High, 2-3 days)
2. **Add tooltips to icon-only buttons** (High, 2-3 days)
3. **Fix keyboard shortcuts** (High, 2-3 days)
4. **Add ARIA labels for accessibility** (High, 2-3 days)

### Phase 2: Consistency Improvements (2-3 weeks)
1. **Standardize panel layouts and spacing** (High, 2-3 days)
2. **Standardize dropdown/popover behaviors** (High, 1-2 days)
3. **Standardize color usage** (Medium, 2-3 days)
4. **Standardize typography** (Medium, 2-3 days)

### Phase 3: Refinements (1-2 weeks)
1. **Standardize terminology and labels** (Medium, 1-2 days)
2. **Standardize help text and placeholders** (Medium, 1-2 days)
3. **Improve responsive design** (Medium, 3-4 days)
4. **Review naming conventions** (Low, 3-5 days, optional)

---

## Design System Document

Create a living design system document at `docs/DESIGN_SYSTEM.md` that includes:

1. **Component Library** - All reusable components with usage examples
2. **Color Palette** - All colors with semantic meaning
3. **Typography Scale** - All text sizes and weights
4. **Spacing System** - Consistent spacing values (4px grid)
5. **Icon Library** - All icons with usage guidelines
6. **Button Variants** - All button styles with use cases
7. **Form Patterns** - Standard form layouts and validations
8. **Keyboard Shortcuts** - Complete shortcut reference
9. **Accessibility Guidelines** - ARIA and keyboard navigation patterns
10. **Responsive Breakpoints** - Standard breakpoints and patterns

**Implementation Priority**: High (create early, update continuously)
**Estimated Effort**: 2-3 days (initial), ongoing maintenance

---

## Testing Checklist

After implementing each improvement:

- [ ] Visual consistency across all panels and dialogs
- [ ] All icon-only buttons have tooltips
- [ ] All keyboard shortcuts work and are documented
- [ ] Screen reader can navigate and use all features
- [ ] Color contrast meets WCAG AA standards
- [ ] All buttons have consistent hover/active states
- [ ] All dropdowns/popovers have consistent behavior
- [ ] Typography is consistent across the app
- [ ] Terminology is consistent (delete vs remove, etc.)
- [ ] Works on mobile, tablet, and desktop
- [ ] All form fields have appropriate labels and help text
- [ ] Error messages are clear and consistent
- [ ] Loading states are consistent
- [ ] Empty states are handled gracefully

---

## Success Metrics

- **User Feedback**: Positive feedback on UI consistency
- **Learning Curve**: Reduced time for new users to learn the interface
- **Accessibility Score**: 100% of interactive elements have ARIA labels
- **Design Debt**: Reduced inconsistencies by 90%
- **Documentation**: Complete design system document created
- **Component Reusability**: 80% of UI uses standardized components

---

## Related Documentation

- [PERFORMANCE_IMPROVEMENTS.md](./PERFORMANCE_IMPROVEMENTS.md) - Performance optimization plan
- [INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md](./INFINITE-LOOPS-MEMORY-LEAKS-ANALYSIS.md) - Memory leak analysis
- [DARK-LIGHT-MODE-PLAN.md](./DARK-LIGHT-MODE-PLAN.md) - Dark/light mode implementation
