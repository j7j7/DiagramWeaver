"use client";
import React, { useState, useEffect } from 'react';
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
import { 
  Palette, 
  Copy, 
  Trash2, 
  Plus, 
  Save, 
  Eye, 
  Edit,
  Check,
  X
} from 'lucide-react';
import { DiagramTheme, ThemeProperties } from '@/lib/theme-types';
import { themeManager } from '@/lib/theme-manager';

interface ThemeEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThemeSelect?: (theme: DiagramTheme) => void;
}

export function ThemeEditor({ open, onOpenChange, onThemeSelect }: ThemeEditorProps) {
  const [themes, setThemes] = useState<DiagramTheme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<DiagramTheme | null>(null);
  const [editingTheme, setEditingTheme] = useState<DiagramTheme | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    setThemes(themeManager.getThemes());
    
    const unsubscribe = themeManager.subscribe((updatedThemes) => {
      setThemes(updatedThemes);
    });
    
    return unsubscribe;
  }, []);

  const handleThemeSelect = (theme: DiagramTheme) => {
    setSelectedTheme(theme);
    setEditingTheme({ ...theme });
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
  };

  const handleSaveTheme = () => {
    if (!editingTheme) return;
    
    if (isCreatingNew) {
      themeManager.addTheme(editingTheme);
      setIsCreatingNew(false);
    } else {
      themeManager.updateTheme(editingTheme.id, editingTheme);
    }
    
    setSelectedTheme(editingTheme);
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
    
    return (
      <div className="w-full h-20 rounded-lg border-2 p-2 relative overflow-hidden"
           style={{
             borderColor: properties.borderColor || '#ccc',
             borderWidth: `${properties.borderWidth || 2}px`,
             borderStyle: properties.borderStyle === 'none' ? 'solid' : properties.borderStyle,
             backgroundColor: properties.backgroundColor || '#f9fafb',
             boxShadow: properties.shadow ? `0 2px ${properties.shadowBlur || 4}px rgba(0,0,0,${properties.shadowOpacity || 0.2})` : 'none'
           }}>
        <div className="flex items-center justify-between h-full">
          <div className="flex-1">
            <div className="text-xs font-medium truncate" 
                 style={{ color: properties.textColor || '#374151' }}>
              {theme.name}
            </div>
            <div className="text-xs opacity-70 truncate" 
                 style={{ color: properties.textColor || '#374151' }}>
              {theme.description}
            </div>
          </div>
          {properties.backgroundStyle === 'gradient' && (
            <div className="w-8 h-8 rounded"
                 style={{
                   background: `linear-gradient(${properties.gradientAngle || 135}deg, ${properties.backgroundColors?.[0] || '#ccc'}, ${properties.backgroundColors?.[1] || '#999'})`
                 }} />
          )}
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
              <Button size="sm" onClick={handleCreateNew}>
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {themes.map((theme) => (
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
                        <span className="font-medium text-sm">{theme.name}</span>
                        {theme.isBuiltIn && <Badge variant="secondary" className="text-xs">Built-in</Badge>}
                        {theme.isDefault && <Badge variant="default" className="text-xs">Default</Badge>}
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
          <div className="lg:col-span-2">
            {editingTheme ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {isCreatingNew ? 'Create New Theme' : 'Edit Theme'}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewMode(!previewMode)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {previewMode ? 'Edit' : 'Preview'}
                    </Button>
                    <Button size="sm" onClick={handleSaveTheme}>
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    {selectedTheme && (
                      <Button size="sm" onClick={handleApplyTheme}>
                        <Check className="h-4 w-4 mr-1" />
                        Apply
                      </Button>
                    )}
                  </div>
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
                          <Input
                            type="color"
                            value={editingTheme.properties.backgroundColor || '#eff6ff'}
                            onChange={(e) => handlePropertyChange('properties.backgroundColor', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Border Color</Label>
                          <Input
                            type="color"
                            value={editingTheme.properties.borderColor || '#3b82f6'}
                            onChange={(e) => handlePropertyChange('properties.borderColor', e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Text Color</Label>
                          <Input
                            type="color"
                            value={editingTheme.properties.textColor || '#1e40af'}
                            onChange={(e) => handlePropertyChange('properties.textColor', e.target.value)}
                          />
                        </div>
                        <div>
                          <Label>Line Color</Label>
                          <Input
                            type="color"
                            value={editingTheme.properties.lineColor || '#3b82f6'}
                            onChange={(e) => handlePropertyChange('properties.lineColor', e.target.value)}
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
                            <Input
                              type="color"
                              value={editingTheme.properties.backgroundColors?.[0] || '#eff6ff'}
                              onChange={(e) => {
                                const colors = [...(editingTheme.properties.backgroundColors || ['#eff6ff', '#dbeafe'])];
                                colors[0] = e.target.value;
                                handlePropertyChange('properties.backgroundColors', colors);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Gradient End Color</Label>
                            <Input
                              type="color"
                              value={editingTheme.properties.backgroundColors?.[1] || '#dbeafe'}
                              onChange={(e) => {
                                const colors = [...(editingTheme.properties.backgroundColors || ['#eff6ff', '#dbeafe'])];
                                colors[1] = e.target.value;
                                handlePropertyChange('properties.backgroundColors', colors);
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {editingTheme.properties.borderStyle === 'gradient' && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Border Start Color</Label>
                            <Input
                              type="color"
                              value={editingTheme.properties.borderColors?.[0] || '#3b82f6'}
                              onChange={(e) => {
                                const colors = [...(editingTheme.properties.borderColors || ['#3b82f6', '#1d4ed8'])];
                                colors[0] = e.target.value;
                                handlePropertyChange('properties.borderColors', colors);
                              }}
                            />
                          </div>
                          <div>
                            <Label>Border End Color</Label>
                            <Input
                              type="color"
                              value={editingTheme.properties.borderColors?.[1] || '#1d4ed8'}
                              onChange={(e) => {
                                const colors = [...(editingTheme.properties.borderColors || ['#3b82f6', '#1d4ed8'])];
                                colors[1] = e.target.value;
                                handlePropertyChange('properties.borderColors', colors);
                              }}
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