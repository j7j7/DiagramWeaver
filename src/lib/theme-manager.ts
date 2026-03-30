import { DiagramTheme, ThemeProperties, ThemeApplicationOptions } from './theme-types';
import type { DiagramNodeData, DiagramGroupData, DiagramConnectionData } from './types';
import { getThemeSpectrumSortKey } from './theme-spectrum';

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
      borderWidth: 1,
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
      borderWidth: 1,
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
      borderWidth: 1,
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
      borderWidth: 1,
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
    name: 'Grey · Light Minimal',
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
    id: 'grey-ash-mist',
    name: 'Grey · Ash Mist',
    description: 'Featherlight cool zinc and silver fog',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#a3a3a3',
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fafafa', '#f4f4f5'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#737373',
      lineWidth: 1.5,
      lineOpacity: 1,
      shadow: false,
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowBlur: 3,
      textColor: '#404040',
      textOpacity: 1,
      gradientAngle: 180
    }
  },
  {
    id: 'grey-charcoal-smoke',
    name: 'Grey · Charcoal Smoke',
    description: 'Charcoal frame on soft smoke white',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#52525b', '#3f3f46'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fafafa', '#e7e5e4'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#3f3f46',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#27272a',
      shadowOpacity: 0.18,
      shadowBlur: 5,
      textColor: '#18181b',
      textOpacity: 1,
      gradientAngle: 165
    }
  },
  {
    id: 'grey-cool-steel',
    name: 'Grey · Cool Steel',
    description: 'Brushed steel with blue-slate chill',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#64748b', '#475569'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#f8fafc', '#e2e8f0'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#334155',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#475569',
      shadowOpacity: 0.22,
      shadowBlur: 5,
      textColor: '#1e293b',
      textOpacity: 1,
      gradientAngle: 135
    }
  },
  {
    id: 'grey-pewter-plate',
    name: 'Grey · Pewter Plate',
    description: 'Cast pewter rim with nickel highlights',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#71717a', '#52525b'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#f4f4f5', '#e4e4e7'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#52525b',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#3f3f46',
      shadowOpacity: 0.2,
      shadowBlur: 4,
      textColor: '#27272a',
      textOpacity: 1,
      gradientAngle: 120
    }
  },
  {
    id: 'grey-warm-concrete',
    name: 'Grey · Warm Concrete',
    description: 'Neutral stone and taupe warmth',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#78716c',
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fafaf9', '#e7e5e4'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#57534e',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#57534e',
      shadowOpacity: 0.15,
      shadowBlur: 4,
      textColor: '#292524',
      textOpacity: 1,
      gradientAngle: 90
    }
  },
  {
    id: 'slate-indigo',
    name: 'Grey · Slate Indigo',
    description: 'Cool steel grey with indigo depth',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#475569',
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#e2e8f0', '#cbd5f5'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#4338ca',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#312e81',
      shadowOpacity: 0.2,
      shadowBlur: 5,
      textColor: '#1e1b4b',
      textOpacity: 1,
      gradientAngle: 160
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
      borderWidth: 1,
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
      borderWidth: 1,
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
      borderWidth: 1,
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
      borderWidth: 1,
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
      borderWidth: 1,
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
  },
  {
    id: 'aurora-teal',
    name: 'Aurora Teal',
    description: 'Teal and sea-glass with crisp contrast',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#0d9488', '#14b8a6'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ccfbf1', '#a7f3d0'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#0f766e',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#0d9488',
      shadowOpacity: 0.28,
      shadowBlur: 6,
      textColor: '#134e4a',
      textOpacity: 1,
      gradientAngle: 118
    }
  },
  {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    description: 'Soft lilac and periwinkle haze',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#a78bfa', '#818cf8'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ede9fe', '#e0e7ff'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#7c3aed',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#8b5cf6',
      shadowOpacity: 0.22,
      shadowBlur: 5,
      textColor: '#4c1d95',
      textOpacity: 1,
      gradientAngle: 135
    }
  },
  {
    id: 'ember-clay',
    name: 'Ember Clay',
    description: 'Terracotta warmth with sand tones',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#c2410c', '#ea580c'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ffedd5', '#fed7aa'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#c2410c',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#ea580c',
      shadowOpacity: 0.3,
      shadowBlur: 6,
      textColor: '#7c2d12',
      textOpacity: 1,
      gradientAngle: 145
    }
  },
  {
    id: 'mint-mocha',
    name: 'Mint Mocha',
    description: 'Fresh mint against rich espresso trim',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#57534e', '#78716c'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ecfccb', '#d9f99d'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#4d7c0f',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#44403c',
      shadowOpacity: 0.22,
      shadowBlur: 5,
      textColor: '#292524',
      textOpacity: 1,
      gradientAngle: 90
    }
  },
  {
    id: 'sakura-blush',
    name: 'Sakura Blush',
    description: 'Cherry blossom pink with rose accents',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#e11d48', '#fb7185'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ffe4e6', '#fecdd3'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#e11d48',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#fb7185',
      shadowOpacity: 0.25,
      shadowBlur: 6,
      textColor: '#881337',
      textOpacity: 1,
      gradientAngle: 125
    }
  },
  {
    id: 'deep-current',
    name: 'Deep Current',
    description: 'Midnight navy with cyan surge',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#06b6d4', '#0891b2'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#0f172a', '#164e63'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#22d3ee',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#000000',
      shadowOpacity: 0.45,
      shadowBlur: 8,
      textColor: '#ecfeff',
      textOpacity: 1,
      gradientAngle: 135
    }
  },
  {
    id: 'olive-grove',
    name: 'Olive Grove',
    description: 'Muted olive and sage on cream',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#65a30d',
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#f7fee7', '#ecfccb'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#4d7c0f',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#65a30d',
      shadowOpacity: 0.2,
      shadowBlur: 4,
      textColor: '#365314',
      textOpacity: 1,
      gradientAngle: 180
    }
  },
  {
    id: 'citron-pop',
    name: 'Citron Pop',
    description: 'Electric citrus with punchy contrast',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#ca8a04', '#a3e635'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#facc15', '#bef264'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#713f12',
      lineWidth: 3,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#ca8a04',
      shadowOpacity: 0.35,
      shadowBlur: 7,
      textColor: '#422006',
      textOpacity: 1,
      gradientAngle: 105
    }
  },
  {
    id: 'merlot-rose',
    name: 'Merlot Rose',
    description: 'Wine burgundy with dusty rose wash',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#881337', '#be123c'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fce7f3', '#fbcfe8'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#9f1239',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#881337',
      shadowOpacity: 0.28,
      shadowBlur: 6,
      textColor: '#4c0519',
      textOpacity: 1,
      gradientAngle: 40
    }
  },
  {
    id: 'blue-midnight-sapphire',
    name: 'Midnight Sapphire',
    description: 'Deep navy field with sapphire highlights',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#1e3a8a', '#312e81'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#0f172a', '#172554'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#3b82f6',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#000000',
      shadowOpacity: 0.5,
      shadowBlur: 8,
      textColor: '#dbeafe',
      textOpacity: 1,
      gradientAngle: 135
    }
  },
  {
    id: 'blue-cobalt-depth',
    name: 'Cobalt Depth',
    description: 'Rich cobalt blue on ink blue ground',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#1d4ed8', '#1e40af'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#172554', '#1e3a8a'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#60a5fa',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#000000',
      shadowOpacity: 0.45,
      shadowBlur: 8,
      textColor: '#eff6ff',
      textOpacity: 1,
      gradientAngle: 125
    }
  },
  {
    id: 'blue-prussian-ink',
    name: 'Prussian Ink',
    description: 'Near-black blue with steel azure lines',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#1e40af',
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#020617', '#0f172a'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#2563eb',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#000000',
      shadowOpacity: 0.55,
      shadowBlur: 9,
      textColor: '#bfdbfe',
      textOpacity: 1,
      gradientAngle: 160
    }
  },
  {
    id: 'nat-moss-bark',
    name: 'Moss & Bark',
    description: 'Forest floor green with deep bark brown',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#3f6212', '#422006'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ecfccb', '#d9f99d'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#365314',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#3f6212',
      shadowOpacity: 0.22,
      shadowBlur: 5,
      textColor: '#1c1917',
      textOpacity: 1,
      gradientAngle: 95
    }
  },
  {
    id: 'nat-sea-glass',
    name: 'Sea Glass',
    description: 'Tumbled coastal aqua and foam white',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#14b8a6', '#2dd4bf'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ecfdf9', '#ccfbf1'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#0f766e',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#14b8a6',
      shadowOpacity: 0.2,
      shadowBlur: 5,
      textColor: '#115e59',
      textOpacity: 1,
      gradientAngle: 110
    }
  },
  {
    id: 'nat-wheat-straw',
    name: 'Wheat Straw',
    description: 'Sun-bleached field gold and chaff',
    isBuiltIn: true,
    properties: {
      borderStyle: 'solid',
      borderColor: '#ca8a04',
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fffbeb', '#fef3c7'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#a16207',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#ca8a04',
      shadowOpacity: 0.18,
      shadowBlur: 4,
      textColor: '#713f12',
      textOpacity: 1,
      gradientAngle: 170
    }
  },
  {
    id: 'nat-redwood',
    name: 'Redwood Grove',
    description: 'Russet cedar heartwood',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#9a3412', '#7c2d12'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ffedd5', '#fed7aa'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#7c2d12',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#9a3412',
      shadowOpacity: 0.25,
      shadowBlur: 5,
      textColor: '#431407',
      textOpacity: 1,
      gradientAngle: 40
    }
  },
  {
    id: 'nat-lichen-stone',
    name: 'Lichen Stone',
    description: 'Grey rock dusted with sage lichen',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#57534e', '#65a30d'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#f5f5f4', '#e7e5e4'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#4d7c0f',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#44403c',
      shadowOpacity: 0.16,
      shadowBlur: 4,
      textColor: '#292524',
      textOpacity: 1,
      gradientAngle: 75
    }
  },
  {
    id: 'nat-desert-sand',
    name: 'Desert Sand',
    description: 'Warm dune ochre and pale dust',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#d97706', '#b45309'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fffbeb', '#fef9c3'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#b45309',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#d97706',
      shadowOpacity: 0.2,
      shadowBlur: 5,
      textColor: '#78350f',
      textOpacity: 1,
      gradientAngle: 155
    }
  },
  {
    id: 'nat-mountain-sky',
    name: 'Mountain Sky',
    description: 'High-altitude blue with cloud mist',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#0284c7', '#0ea5e9'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#f0f9ff', '#e0f2fe'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#0369a1',
      lineWidth: 2,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#0284c7',
      shadowOpacity: 0.2,
      shadowBlur: 5,
      textColor: '#0c4a6e',
      textOpacity: 1,
      gradientAngle: 130
    }
  },
  {
    id: 'nat-peat-earth',
    name: 'Peat Earth',
    description: 'Rich bog soil and dark humus',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#78350f', '#92400e'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fef3c7', '#fde68a'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#78350f',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#451a03',
      shadowOpacity: 0.28,
      shadowBlur: 6,
      textColor: '#431407',
      textOpacity: 1,
      gradientAngle: 25
    }
  },
  {
    id: 'nat-tide-pool',
    name: 'Tide Pool',
    description: 'Shallow reef teal meeting indigo depth',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#0e7490', '#155e75'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#ecfeff', '#cffafe'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#155e75',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#0e7490',
      shadowOpacity: 0.24,
      shadowBlur: 5,
      textColor: '#164e63',
      textOpacity: 1,
      gradientAngle: 140
    }
  },
  {
    id: 'nat-autumn-leaf',
    name: 'Autumn Leaf',
    description: 'Maple rust, ochre, and dried gold',
    isBuiltIn: true,
    properties: {
      borderStyle: 'gradient',
      borderColors: ['#c2410c', '#b45309'],
      borderWidth: 1,
      backgroundStyle: 'gradient',
      backgroundColors: ['#fff7ed', '#ffedd5'],
      backgroundOpacity: 1,
      lineStyle: 'solid',
      lineColor: '#9a3412',
      lineWidth: 2.5,
      lineOpacity: 1,
      shadow: true,
      shadowColor: '#c2410c',
      shadowOpacity: 0.22,
      shadowBlur: 6,
      textColor: '#7c2d12',
      textOpacity: 1,
      gradientAngle: 60
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
      
      // Within built-in themes, sort around the colour spectrum (neutrals last)
      if (a.isBuiltIn && b.isBuiltIn) {
        const ka = getThemeSpectrumSortKey(a);
        const kb = getThemeSpectrumSortKey(b);
        if (Math.abs(ka - kb) > 1e-6) return ka - kb;
        return a.name.localeCompare(b.name);
      }
      
      // Custom themes: spectrum order, then date, then name
      const ka = getThemeSpectrumSortKey(a);
      const kb = getThemeSpectrumSortKey(b);
      if (Math.abs(ka - kb) > 1e-6) return ka - kb;
      const aDate = a.createdAt || a.updatedAt || '';
      const bDate = b.createdAt || b.updatedAt || '';
      if (aDate && bDate) {
        return aDate.localeCompare(bDate);
      }
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
      // Keep legacy single-color field in sync for renderers that still read borderColor.
      if (properties.borderColors.length > 0) {
        (updated as any).borderColor = properties.borderColors[0];
      }
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
      // Keep legacy single-color field in sync for renderers that still read backgroundColor.
      if (properties.backgroundColors.length > 0) {
        (updated as any).backgroundColor = properties.backgroundColors[0];
      }
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