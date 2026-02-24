import { DiagramTheme, ThemeProperties, ThemeApplicationOptions } from './theme-types';
import type { DiagramNodeData, DiagramGroupData, DiagramConnectionData } from './types';

const THEME_STORAGE_KEY = 'diagram-weaver-themes';

// Default built-in themes
export const DEFAULT_THEMES: DiagramTheme[] = [
  {
    id: 'default-blue',
    name: 'Ocean Blue',
    description: 'Professional blue theme with clean borders',
    isDefault: true,
    isBuiltIn: true,
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
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    description: 'Warm orange theme with gradient backgrounds',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#f97316', '#ea580c'],
      borderWidth: 2,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fed7aa', '#ffedd5'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#f97316',
      lineWidth: 3,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#f97316',
      shadowOpacity: 0.3,
      shadowBlur: 6,
      textColor: '#9a3412',
      textOpacity: 1,
      gradientAngle: 135
    }
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    description: 'Natural green theme with organic feel',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#16a34a',
      borderWidth: 2,
      backgroundStyle: 'solid',
      backgroundColor: '#f0fdf4',
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#16a34a',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#16a34a',
      shadowOpacity: 0.25,
      shadowBlur: 5,
      textColor: '#14532d',
      textOpacity: 1,
      gradientAngle: 90
    }
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    description: 'Elegant purple theme with luxury feel',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#9333ea', '#7c3aed'],
      borderWidth: 3,
      backgroundStyle: 'gradient',
      backgroundColors: ['#f3e8ff', '#ede9fe'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#9333ea',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#9333ea',
      shadowOpacity: 0.3,
      shadowBlur: 8,
      textColor: '#581c87',
      textOpacity: 1,
      gradientAngle: 45
    }
  },
  {
    id: 'minimal-gray',
    name: 'Minimal Gray',
    description: 'Clean minimalist gray theme',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#6b7280',
      borderWidth: 1,
      backgroundStyle: 'solid',
      backgroundColor: '#f9fafb',
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#6b7280',
      lineWidth: 1.5,
      lineOpacity: 1,
      shadow: false,
      shadowColor: '#000000',
      shadowOpacity: 0.1,
      shadowBlur: 2,
      textColor: '#374151',
      textOpacity: 1,
      gradientAngle: 0
    }
  },
  {
    id: 'coral-red',
    name: 'Coral Red',
    description: 'Vibrant coral theme with energy',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#f43f5e',
      borderWidth: 2,
      backgroundStyle: 'solid',
      backgroundColor: '#fff1f2',
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#f43f5e',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#f43f5e',
      shadowOpacity: 0.25,
      shadowBlur: 6,
      textColor: '#881337',
      textOpacity: 1,
      gradientAngle: 180
    }
  },
  {
    id: 'sky-cyan',
    name: 'Sky Cyan',
    description: 'Fresh cyan theme with clarity',
    isBuiltIn: true,
    properties: {
      borderStyle: 'dotted',
      borderColor: '#06b6d4',
      borderWidth: 2,
      backgroundStyle: 'solid',
      backgroundColor: '#ecfeff',
      backgroundOpacity: 1,
      lineStyle: 'dotted',
      lineColor: '#06b6d4',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#06b6d4',
      shadowOpacity: 0.2,
      shadowBlur: 4,
      textColor: '#164e63',
      textOpacity: 1,
      gradientAngle: 90
    }
  },
  {
    id: 'golden-yellow',
    name: 'Golden Yellow',
    description: 'Bright yellow theme with optimism',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#facc15', '#f59e0b'],
      borderWidth: 3,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fefce8', '#fef3c7'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#f59e0b',
      lineWidth: 3,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#f59e0b',
      shadowOpacity: 0.3,
      shadowBlur: 7,
      textColor: '#713f12',
      textOpacity: 1,
      gradientAngle: 135
    }
  },
  {
    id: 'midnight-dark',
    name: 'Midnight Dark',
    description: 'Dark theme with high contrast',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#1f2937',
      borderWidth: 2,
      backgroundStyle: 'solid',
      backgroundColor: '#111827',
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#4b5563',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowBlur: 8,
      textColor: '#f9fafb',
      textOpacity: 1,
      gradientAngle: 0
    }
  },
  {
    id: 'rose-pink',
    name: 'Rose Pink',
    description: 'Soft pink theme with elegance',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#f472b6',
      borderWidth: 2,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fdf2f8', '#fce7f3'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#f472b6',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#f472b6',
      shadowOpacity: 0.25,
      shadowBlur: 5,
      textColor: '#831843',
      textOpacity: 1,
      gradientAngle: 135
    }
  }
];

class ThemeManager {
  private themes: DiagramTheme[] = [];
  private listeners: ((themes: DiagramTheme[]) => void)[] = [];

  constructor() {
    this.loadThemes();
  }

  private loadThemes(): void {
    try {
      // Check if localStorage is available (not during SSR)
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        this.themes = [...DEFAULT_THEMES];
        return;
      }
      
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored) {
        const parsedThemes = JSON.parse(stored);
        // Merge with default themes, allowing custom themes to override built-in ones
        this.themes = [...DEFAULT_THEMES.filter(t => !parsedThemes.some((p: DiagramTheme) => p.id === t.id)), ...parsedThemes];
      } else {
        this.themes = [...DEFAULT_THEMES];
      }
    } catch (error) {
      console.error('Failed to load themes from localStorage:', error);
      this.themes = [...DEFAULT_THEMES];
    }
  }

  private saveThemes(): void {
    try {
      // Check if localStorage is available (not during SSR)
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return;
      }
      
      const customThemes = this.themes.filter(t => !t.isBuiltIn);
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(customThemes));
      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save themes to localStorage:', error);
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.themes));
  }

  public getThemes(): DiagramTheme[] {
    return [...this.themes];
  }

  public getThemesSorted(): DiagramTheme[] {
    return [...this.themes].sort((a, b) => {
      // Favorites first
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      
      // Built-in themes before custom themes
      if (a.isBuiltIn && !b.isBuiltIn) return -1;
      if (!a.isBuiltIn && b.isBuiltIn) return 1;
      
      // Within built-in themes, sort by name
      if (a.isBuiltIn && b.isBuiltIn) {
        return a.name.localeCompare(b.name);
      }
      
      // Custom themes: sort by creation date (newest last) or updated date
      const aDate = a.createdAt || a.updatedAt || '';
      const bDate = b.createdAt || b.updatedAt || '';
      if (aDate && bDate) {
        return aDate.localeCompare(bDate);
      }
      
      // Fallback to name
      return a.name.localeCompare(b.name);
    });
  }

  public toggleFavorite(themeId: string): void {
    const theme = this.themes.find(t => t.id === themeId);
    if (theme) {
      theme.isFavorite = !theme.isFavorite;
      this.saveThemes();
    }
  }

  public exportThemes(): string {
    const customThemes = this.themes.filter(t => !t.isBuiltIn);
    return JSON.stringify(customThemes, null, 2);
  }

  public importThemes(themesJson: string): { success: number; errors: string[] } {
    const errors: string[] = [];
    let success = 0;

    try {
      const importedThemes = JSON.parse(themesJson);
      if (!Array.isArray(importedThemes)) {
        errors.push('Invalid format: Expected an array of themes');
        return { success, errors };
      }

      for (const themeData of importedThemes) {
        try {
          // Validate required fields
          if (!themeData.id || !themeData.name || !themeData.properties) {
            errors.push(`Invalid theme: ${themeData.name || 'Unknown'} - missing required fields`);
            continue;
          }

          // Create a proper theme object with defaults
          const theme: DiagramTheme = {
            id: themeData.id,
            name: themeData.name,
            description: themeData.description || '',
            properties: themeData.properties,
            isBuiltIn: false,
            isDefault: false,
            isFavorite: themeData.isFavorite || false,
            createdAt: themeData.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          // Check for conflicts and add suffix if needed
          let finalId = theme.id;
          let counter = 1;
          while (this.themes.some(t => t.id === finalId)) {
            finalId = `${theme.id}-${counter}`;
            counter++;
          }
          theme.id = finalId;

          this.addTheme(theme);
          success++;
        } catch (error) {
          errors.push(`Failed to import theme: ${themeData.name || 'Unknown'} - ${error}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to parse JSON: ${error}`);
    }

    return { success, errors };
  }

  public addTheme(theme: DiagramTheme): void {
    const existingIndex = this.themes.findIndex(t => t.id === theme.id);
    if (existingIndex >= 0) {
      this.themes[existingIndex] = { ...theme, updatedAt: new Date().toISOString() };
    } else {
      this.themes.push({ ...theme, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.saveThemes();
  }

  public updateTheme(id: string, updates: Partial<DiagramTheme>): void {
    const index = this.themes.findIndex(theme => theme.id === id);
    if (index >= 0) {
      this.themes[index] = { 
        ...this.themes[index], 
        ...updates, 
        updatedAt: new Date().toISOString() 
      };
      this.saveThemes();
    }
  }

  public deleteTheme(id: string): boolean {
    if (this.themes.find(theme => theme.id === id)?.isBuiltIn) {
      return false; // Cannot delete built-in themes
    }
    const index = this.themes.findIndex(theme => theme.id === id);
    if (index >= 0) {
      this.themes.splice(index, 1);
      this.saveThemes();
      return true;
    }
    return false;
  }

  public duplicateTheme(id: string, newName: string): DiagramTheme | null {
    const original = this.themes.find(theme => theme.id === id);
    if (!original) return null;

    // Deep clone the properties object to avoid shared references
    const clonedProperties: ThemeProperties = {
      ...original.properties,
      // Deep clone arrays if they exist
      borderColors: original.properties.borderColors ? [...original.properties.borderColors] : undefined,
      backgroundColors: original.properties.backgroundColors ? [...original.properties.backgroundColors] : undefined,
    };

    const duplicate: DiagramTheme = {
      ...original,
      id: `${original.id}-copy-${Date.now()}`,
      name: newName,
      isBuiltIn: false,
      isDefault: false,
      properties: clonedProperties,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.addTheme(duplicate);
    return duplicate;
  }

  public subscribe(listener: (themes: DiagramTheme[]) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public applyThemeToItem(
    item: DiagramNodeData | DiagramGroupData | DiagramConnectionData,
    theme: DiagramTheme,
    options: ThemeApplicationOptions = {}
  ): DiagramNodeData | DiagramGroupData | DiagramConnectionData {
    const { properties } = theme;
    const updated = { ...item };

    // Apply border properties
    if (properties.borderStyle !== undefined) {
      (updated as any).borderStyle = properties.borderStyle;
    }
    if (properties.borderColor !== undefined) {
      (updated as any).borderColor = properties.borderColor;
    }
    if (properties.borderColors !== undefined) {
      (updated as any).borderColors = properties.borderColors;
    }
    if (properties.borderWidth !== undefined) {
      (updated as any).borderWidth = properties.borderWidth;
    }

    // Apply background properties
    if (properties.backgroundStyle !== undefined) {
      (updated as any).backgroundStyle = properties.backgroundStyle;
    }
    if (properties.backgroundColor !== undefined) {
      (updated as any).backgroundColor = properties.backgroundColor;
    }
    if (properties.backgroundColors !== undefined) {
      (updated as any).backgroundColors = properties.backgroundColors;
    }

    // Apply line properties (for connections)
    if ('color' in updated && properties.lineColor !== undefined) {
      (updated as any).color = properties.lineColor;
    }
    if ('lineWidth' in updated && properties.lineWidth !== undefined) {
      (updated as any).lineWidth = properties.lineWidth;
    }

    // Apply shadow
    if (properties.shadow !== undefined) {
      (updated as any).shadow = properties.shadow;
    }

    // Apply text color
    if (properties.textColor !== undefined) {
      (updated as any).textColor = properties.textColor;
    }

    // Apply gradient angles
    if (properties.gradientAngle !== undefined) {
      (updated as any).gradientAngle = properties.gradientAngle;
    }
    if (properties.borderGradientAngle !== undefined) {
      (updated as any).borderGradientAngle = properties.borderGradientAngle;
    }

    return updated;
  }
}

export const themeManager = new ThemeManager();
export default themeManager;