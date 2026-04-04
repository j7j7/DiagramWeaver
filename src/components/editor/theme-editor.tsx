"use client";
import React, { useState, useEffect, useRef } from 'react';
import type { SaveFilePickerOptions, OpenFilePickerOptions } from '@/types/file-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ColorPicker } from '@/components/ui/color-picker';
import { 
  Palette, 
  Copy, 
  Trash2, 
  Plus, 
  Save, 
  Eye, 
  Edit,
  Check,
  X,
  Star,
  Download,
  Upload
} from 'lucide-react';
import { DiagramTheme, ThemeProperties } from '@/lib/theme-types';
import { themeManager } from '@/lib/theme-manager';
import { getVisualStylingCSS, themePropertiesToVisualStyling } from '@/lib/visual-styling';

interface ThemeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThemeSelect?: (theme: DiagramTheme) => void;
  isReadOnly?: boolean;
}

export function ThemeEditor({ open, onOpenChange, onThemeSelect, isReadOnly = false }: ThemeEditorProps) {
  const [themes, setThemes] = useState<DiagramTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<DiagramTheme | null>(null);
  const [editingTheme, setEditingTheme] = useState<DiagramTheme | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const editorPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setThemes(themeManager.getThemesSorted());
    
    const unsubscribe = themeManager.subscribe(() => {
      setThemes(themeManager.getThemesSorted());
    });
    
    return unsubscribe;
  }, []);

  const handleThemeSelect = (theme: DiagramTheme) => {
    setSelectedTheme(theme);
    // Deep clone the theme and its properties to avoid shared references
    const clonedProperties: ThemeProperties = {
      ...theme.properties,
      borderColors: theme.properties.borderColors ? [...theme.properties.borderColors] : undefined,
      backgroundColors: theme.properties.backgroundColors ? [...theme.properties.backgroundColors] : undefined,
    };
    setEditingTheme({ ...theme, properties: clonedProperties });
    setIsCreatingNew(false);
  };

  const handleCreateNew = () => {
    const newTheme: DiagramTheme = {
      id: `custom-${Date.now()}`,
      name: 'New Theme',
      description: 'Custom theme',
      isBuiltIn: false,
      properties: {
        borderStyle: 'solid',
        borderColor: '#3b82f6',
        borderWidth: 2,
        backgroundStyle: 'solid',
        backgroundColor: '#eff6ff',
        backgroundOpacity: 1,
        lineStyle: 'solid',
        lineColor: '#3b82f6',
        lineWidth: 2.5,
        lineOpacity: 1,
        shadow: true,
        shadowColor: '#000000',
        shadowOpacity: 0.2,
        shadowBlur: 4,
        textColor: '#1e40af',
        textOpacity: 1,
        gradientAngle: 135
      }
    };
    
    setEditingTheme(newTheme);
    setIsCreatingNew(true);
    setSelectedTheme(null);
    
    // Scroll editor panel into view after state update
    setTimeout(() => {
      editorPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handleSaveTheme = () => {
    if (!editingTheme) return;
    
    // Deep clone properties before saving to ensure we're saving a clean copy
    const clonedProperties: ThemeProperties = {
      ...editingTheme.properties,
      borderColors: editingTheme.properties.borderColors ? [...editingTheme.properties.borderColors] : undefined,
      backgroundColors: editingTheme.properties.backgroundColors ? [...editingTheme.properties.backgroundColors] : undefined,
    };
    const themeToSave = { ...editingTheme, properties: clonedProperties };
    
    if (isCreatingNew) {
      themeManager.addTheme(themeToSave);
      setIsCreatingNew(false);
      // Update the editing theme to the saved version
      setEditingTheme(themeToSave);
    } else {
      themeManager.updateTheme(editingTheme.id, themeToSave);
    }
    
    setSelectedTheme(themeToSave);
  };

  const handleDuplicateTheme = (theme: DiagramTheme) => {
    const duplicate = themeManager.duplicateTheme(theme.id, `${theme.name} (Copy)`);
    if (duplicate) {
      handleThemeSelect(duplicate);
    }
  };

  const handleDeleteTheme = (themeId: string) => {
    if (confirm('Are you sure you want to delete this theme?')) {
      themeManager.deleteTheme(themeId);
      if (selectedTheme?.id === themeId) {
        setSelectedTheme(null);
        setEditingTheme(null);
      }
    }
  };

  const handleToggleFavorite = (themeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    themeManager.toggleFavorite(themeId);
  };

  const handleExportThemes = async () => {
    try {
      const themesJson = themeManager.exportThemes();
      
      // Use the File System Access API if available (modern browsers)
      if (window.showSaveFilePicker) {
        const fileHandle = await window.showSaveFilePicker({
          suggestedName: 'diagram-themes.json',
          types: [{
            description: 'JSON files',
            accept: { 'application/json': ['.json'] },
          }],
        });
        
        const writable = await fileHandle.createWritable();
        await writable.write(themesJson);
        await writable.close();
      } else {
        // Fallback for browsers without File System Access API
        const blob = new Blob([themesJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'diagram-themes.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  const handleImportThemes = async () => {
    try {
      let fileContent: string = '';
      
      // Use the File System Access API if available (modern browsers)
      if (window.showOpenFilePicker) {
        const [fileHandle] = await window.showOpenFilePicker({
          types: [{
            description: 'JSON files',
            accept: { 'application/json': ['.json'] },
          }],
          multiple: false,
        });
        
        const file = await fileHandle.getFile();
        fileContent = await file.text();
      } else {
        // Fallback for browsers without File System Access API
        fileContent = await new Promise<string>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.json';
          input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
              const content = await file.text();
              resolve(content);
            } else {
              resolve('');
            }
          };
          input.oncancel = () => resolve('');
          input.click();
        });
      }
      
      if (fileContent) {
        const result = themeManager.importThemes(fileContent);
        
        if (result.success > 0) {
          alert(`Successfully imported ${result.success} theme(s)`);
        }
        
        if (result.errors.length > 0) {
          alert(`Errors:\n${result.errors.join('\n')}`);
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // User cancelled the file picker
        return;
      }
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format and try again.');
    }
  };

  const handlePropertyChange = (propertyPath: string, value: any) => {
    if (!editingTheme) return;
    
    const updated = { ...editingTheme };
    const pathParts = propertyPath.split('.');
    let current: any = updated;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      if (!current[pathParts[i]]) {
        current[pathParts[i]] = {};
      }
      current = current[pathParts[i]];
    }
    
    current[pathParts[pathParts.length - 1]] = value;
    setEditingTheme(updated);
  };

  const handleApplyTheme = () => {
    if (selectedTheme && onThemeSelect) {
      onThemeSelect(selectedTheme);
      onOpenChange(false);
    }
  };

  const renderThemePreview = (theme: DiagramTheme) => {
    const { properties } = theme;
    const panelStyle = getVisualStylingCSS({
      ...themePropertiesToVisualStyling(properties),
      borderWidth: properties.borderWidth ?? 2,
      shadow: false,
    });
    return (
      <div
        className="w-full h-20 rounded-lg p-2 relative overflow-hidden"
        style={{
          ...panelStyle,
          boxShadow: properties.shadow
            ? `0 2px ${properties.shadowBlur || 4}px rgba(0,0,0,${properties.shadowOpacity || 0.2})`
            : undefined,
        }}
      >
        <div className="flex items-center justify-between h-full relative z-[1]">
          <div className="flex-1 min-w-0 pr-2">
            <div
              className="text-xs font-medium truncate"
              style={{ color: properties.textColor || '#374151' }}
            >
              {theme.name}
            </div>
            <div
              className="text-xs opacity-70 truncate"
              style={{ color: properties.textColor || '#374151' }}
            >
              {theme.description}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme Editor
          </DialogTitle>
          <DialogDescription>
            Create, edit, and manage color themes for your diagrams
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Theme List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Themes</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleExportThemes}>
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <Button size="sm" variant="outline" onClick={handleImportThemes}>
                  <Upload className="h-4 w-4 mr-1" />
                  Import
                </Button>
                <Button 
                  size="sm" 
                  variant="default"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCreateNew();
                  }}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">New</span>
                </Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {themeManager.getThemesSorted().map((theme) => (
                <Card 
                  key={theme.id} 
                  className={`cursor-pointer transition-all ${
                    selectedTheme?.id === theme.id ? 'ring-2 ring-blue-500' : 'hover:shadow-md'
                  }`}
                  onClick={() => handleThemeSelect(theme)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => handleToggleFavorite(theme.id, e)}
                        >
                          <Star 
                            className={`h-3 w-3 ${theme.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} 
                          />
                        </Button>
                        <span className="font-medium text-sm">{theme.name}</span>
                        {theme.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateTheme(theme);
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        {!theme.isBuiltIn && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTheme(theme.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {renderThemePreview(theme)}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Theme Editor */}
          <div className="lg:col-span-2" ref={editorPanelRef}>
            {editingTheme ? (
              <div className="space-y-4">
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreviewMode(!previewMode)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    {previewMode ? 'Edit' : 'Preview'}
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSaveTheme}>
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  {selectedTheme && (
                    <Button variant="outline" size="sm" onClick={handleApplyTheme} disabled={isReadOnly}>
                      <Check className="h-4 w-4 mr-1" />
                      Apply
                    </Button>
                  )}
                </div>

                {previewMode ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {renderThemePreview(editingTheme)}
                    </CardContent>
                  </Card>
                ) : (
                  <Tabs defaultValue="basic" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="basic">Basic</TabsTrigger>
                      <TabsTrigger value="borders">Borders</TabsTrigger>
                      <TabsTrigger value="advanced">Advanced</TabsTrigger>
                    </TabsList>

                    <TabsContent value="basic" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="theme-name">Theme Name</Label>
                          <Input
                            id="theme-name"
                            value={editingTheme.name}
                            onChange={(e) => setEditingTheme({ ...editingTheme, name: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="theme-description">Description</Label>
                          <Input
                            id="theme-description"
                            value={editingTheme.description || ''}
                            onChange={(e) => setEditingTheme({ ...editingTheme, description: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Background Style</Label>
                          <Select
                            value={editingTheme.properties.backgroundStyle}
                            onValueChange={(value) => handlePropertyChange('properties.backgroundStyle', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solid">Solid</SelectItem>
                              <SelectItem value="gradient">Gradient</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Border Style</Label>
                          <Select
                            value={editingTheme.properties.borderStyle}
                            onValueChange={(value) => handlePropertyChange('properties.borderStyle', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="solid">Solid</SelectItem>
                              <SelectItem value="dotted">Dotted</SelectItem>
                              <SelectItem value="gradient">Gradient</SelectItem>
                              <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Background Color</Label>
                          <ColorPicker
                            value={editingTheme.properties.backgroundColor || '#eff6ff'}
                            onChange={(value) => handlePropertyChange('properties.backgroundColor', value)}
                            placeholder="#eff6ff"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div>
                          <Label>Border Color</Label>
                          <ColorPicker
                            value={editingTheme.properties.borderColor || '#3b82f6'}
                            onChange={(value) => handlePropertyChange('properties.borderColor', value)}
                            placeholder="#3b82f6"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Text Color</Label>
                          <ColorPicker
                            value={editingTheme.properties.textColor || '#1e40af'}
                            onChange={(value) => handlePropertyChange('properties.textColor', value)}
                            placeholder="#1e40af"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                        <div>
                          <Label>Line Color</Label>
                          <ColorPicker
                            value={editingTheme.properties.lineColor || '#3b82f6'}
                            onChange={(value) => handlePropertyChange('properties.lineColor', value)}
                            placeholder="#3b82f6"
                            showAlpha={true}
                            allowTransparent={true}
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="borders" className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Border Width</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[editingTheme.properties.borderWidth || 2]}
                              onValueChange={(value) => handlePropertyChange('properties.borderWidth', value[0])}
                              min={0}
                              max={10}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm w-8">{editingTheme.properties.borderWidth || 2}px</span>
                          </div>
                        </div>
                        <div>
                          <Label>Line Width</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[editingTheme.properties.lineWidth || 2.5]}
                              onValueChange={(value) => handlePropertyChange('properties.lineWidth', value[0])}
                              min={0.5}
                              max={10}
                              step={0.5}
                              className="flex-1"
                            />
                            <span className="text-sm w-12">{editingTheme.properties.lineWidth || 2.5}px</span>
                          </div>
                        </div>
                      </div>

                      {editingTheme.properties.backgroundStyle === 'gradient' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Gradient Start Color</Label>
                            <ColorPicker
                              value={editingTheme.properties.backgroundColors?.[0] || '#eff6ff'}
                              onChange={(value) => {
                                const colors = [...(editingTheme.properties.backgroundColors || ['#eff6ff', '#dbeafe'])];
                                colors[0] = value;
                                handlePropertyChange('properties.backgroundColors', colors);
                              }}
                              placeholder="#eff6ff"
                              showAlpha={true}
                              allowTransparent={true}
                            />
                          </div>
                          <div>
                            <Label>Gradient End Color</Label>
                            <ColorPicker
                              value={editingTheme.properties.backgroundColors?.[1] || '#dbeafe'}
                              onChange={(value) => {
                                const colors = [...(editingTheme.properties.backgroundColors || ['#eff6ff', '#dbeafe'])];
                                colors[1] = value;
                                handlePropertyChange('properties.backgroundColors', colors);
                              }}
                              placeholder="#dbeafe"
                              showAlpha={true}
                              allowTransparent={true}
                            />
                          </div>
                        </div>
                      )}

                      {editingTheme.properties.borderStyle === 'gradient' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Border Start Color</Label>
                            <ColorPicker
                              value={editingTheme.properties.borderColors?.[0] || '#3b82f6'}
                              onChange={(value) => {
                                const colors = [...(editingTheme.properties.borderColors || ['#3b82f6', '#1d4ed8'])];
                                colors[0] = value;
                                handlePropertyChange('properties.borderColors', colors);
                              }}
                              placeholder="#3b82f6"
                              showAlpha={true}
                              allowTransparent={true}
                            />
                          </div>
                          <div>
                            <Label>Border End Color</Label>
                            <ColorPicker
                              value={editingTheme.properties.borderColors?.[1] || '#1d4ed8'}
                              onChange={(value) => {
                                const colors = [...(editingTheme.properties.borderColors || ['#3b82f6', '#1d4ed8'])];
                                colors[1] = value;
                                handlePropertyChange('properties.borderColors', colors);
                              }}
                              placeholder="#1d4ed8"
                              showAlpha={true}
                              allowTransparent={true}
                            />
                          </div>
                        </div>
                      )}

                      {(editingTheme.properties.backgroundStyle === 'gradient' || editingTheme.properties.borderStyle === 'gradient') && (
                        <div>
                          <Label>Gradient Angle</Label>
                          <Select
                            value={String(editingTheme.properties.gradientAngle || 135)}
                            onValueChange={(value) => handlePropertyChange('properties.gradientAngle', parseInt(value))}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">0° (Right)</SelectItem>
                              <SelectItem value="45">45° (Diagonal ↗)</SelectItem>
                              <SelectItem value="90">90° (Up)</SelectItem>
                              <SelectItem value="135">135° (Diagonal ↘)</SelectItem>
                              <SelectItem value="180">180° (Left)</SelectItem>
                              <SelectItem value="-45">-45° (Alt Diagonal ↗)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="advanced" className="space-y-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Shadow</Label>
                          <Switch
                            checked={editingTheme.properties.shadow}
                            onCheckedChange={(checked) => handlePropertyChange('properties.shadow', checked)}
                          />
                        </div>

                        {editingTheme.properties.shadow && (
                          <div className="grid grid-cols-2 gap-4 pl-6">
                            <div>
                              <Label>Shadow Opacity</Label>
                              <div className="flex items-center gap-2">
                                <Slider
                                  value={[editingTheme.properties.shadowOpacity || 0.2]}
                                  onValueChange={(value) => handlePropertyChange('properties.shadowOpacity', value[0])}
                                  min={0}
                                  max={1}
                                  step={0.1}
                                  className="flex-1"
                                />
                                <span className="text-sm w-12">{(editingTheme.properties.shadowOpacity || 0.2).toFixed(1)}</span>
                              </div>
                            </div>
                            <div>
                              <Label>Shadow Blur</Label>
                              <div className="flex items-center gap-2">
                                <Slider
                                  value={[editingTheme.properties.shadowBlur || 4]}
                                  onValueChange={(value) => handlePropertyChange('properties.shadowBlur', value[0])}
                                  min={0}
                                  max={20}
                                  step={1}
                                  className="flex-1"
                                />
                                <span className="text-sm w-8">{editingTheme.properties.shadowBlur || 4}px</span>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Background Opacity</Label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[editingTheme.properties.backgroundOpacity || 1]}
                                onValueChange={(value) => handlePropertyChange('properties.backgroundOpacity', value[0])}
                                min={0}
                                max={1}
                                step={0.1}
                                className="flex-1"
                              />
                              <span className="text-sm w-12">{(editingTheme.properties.backgroundOpacity || 1).toFixed(1)}</span>
                            </div>
                          </div>
                          <div>
                            <Label>Line Opacity</Label>
                            <div className="flex items-center gap-2">
                              <Slider
                                value={[editingTheme.properties.lineOpacity || 1]}
                                onValueChange={(value) => handlePropertyChange('properties.lineOpacity', value[0])}
                                min={0}
                                max={1}
                                step={0.1}
                                className="flex-1"
                              />
                              <span className="text-sm w-12">{(editingTheme.properties.lineOpacity || 1).toFixed(1)}</span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label>Text Opacity</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              value={[editingTheme.properties.textOpacity || 1]}
                              onValueChange={(value) => handlePropertyChange('properties.textOpacity', value[0])}
                              min={0}
                              max={1}
                              step={0.1}
                              className="flex-1"
                            />
                            <span className="text-sm w-12">{(editingTheme.properties.textOpacity || 1).toFixed(1)}</span>
                          </div>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center">
                  <Palette className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a theme to edit or create a new one</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}