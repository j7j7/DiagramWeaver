# DiagramWeaver - Requirements for Network Restricted Environment

This document outlines all required libraries and dependencies to build and run DiagramWeaver in a network-restricted environment.

## Core Framework & Runtime

### Required Node.js Version
- **Node.js**: Version 18.x or higher (required for Next.js 15)

### Core Dependencies
- **next**: 15.3.3 - React framework
- **react**: 18.3.1 - UI library
- **react-dom**: 18.3.1 - React DOM renderer

## Development Dependencies

### TypeScript & Build Tools
- **typescript**: ^5 - TypeScript compiler
- **@types/node**: ^20 - Node.js type definitions
- **@types/react**: ^18 - React type definitions
- **@types/react-dom**: ^18 - React DOM type definitions

### Code Quality & Linting
- **eslint**: 9.38.0 - JavaScript linter
- **eslint-config-next**: 16.0.0 - Next.js ESLint configuration

### CSS & Styling
- **tailwindcss**: 3.4.1 - Utility-first CSS framework
- **postcss**: ^8 - CSS post-processor
- **tailwindcss-animate**: 1.0.7 - Animation utilities for Tailwind

## Production Dependencies

### UI Components & Libraries
- **@radix-ui/*** (Multiple packages) - Headless UI components:
  - react-accordion: ^1.2.3
  - react-alert-dialog: ^1.1.6
  - react-avatar: ^1.1.3
  - react-checkbox: ^1.1.4
  - react-collapsible: ^1.1.11
  - react-dialog: ^1.1.6
  - react-dropdown-menu: ^2.1.6
  - react-label: ^2.1.2
  - react-menubar: ^1.1.6
  - react-popover: ^1.1.6
  - react-progress: ^1.1.2
  - react-radio-group: ^1.2.3
  - react-scroll-area: ^1.2.3
  - react-select: ^2.1.6
  - react-separator: ^1.1.2
  - react-slider: ^1.2.3
  - react-slot: ^1.2.3
  - react-switch: ^1.1.3
  - react-tabs: ^1.1.3
  - react-toast: ^1.2.6
  - react-tooltip: ^1.1.8

### Code Editor & Syntax Highlighting
- **@codemirror/*** (Multiple packages) - Code editor:
  - lang-json: ^6.0.2
  - lint: ^6.9.1
  - state: ^6.5.2
  - theme-one-dark: ^6.1.3
  - view: ^6.38.6
- **@uiw/react-codemirror**: ^4.25.2 - React CodeMirror wrapper

### Form Handling & Validation
- **react-hook-form**: ^7.54.2 - Form library
- **@hookform/resolvers**: ^4.1.3 - Form validation resolvers
- **zod**: ^3.24.2 - Schema validation

### Drag & Drop
- **react-dnd**: ^16.0.1 - Drag and drop for React
- **react-dnd-html5-backend**: ^16.0.1 - HTML5 backend for react-dnd

### Utilities & Helpers
- **class-variance-authority**: ^0.7.1 - Utility for component variants
- **clsx**: ^2.1.1 - Utility for constructing className strings
- **tailwind-merge**: ^3.0.1 - Utility for merging Tailwind classes
- **date-fns**: ^3.6.0 - Date utility library
- **lucide-react**: ^0.475.0 - Icon library
- **html-to-image**: ^1.11.13 - Convert DOM to image
- **dotenv**: ^16.5.0 - Environment variable management
### Data Visualization & UI Components
- **recharts**: ^2.15.1 - Chart library
- **react-resizable-panels**: ^3.0.6 - Resizable panel components
- **embla-carousel-react**: ^8.6.0 - Carousel component
- **react-day-picker**: ^8.10.1 - Date picker component

## Installation Commands

For a network-restricted environment, you'll need to download these packages manually or configure your package manager to use an internal registry:

```bash
# Using npm with custom registry (if available)
npm install --registry=http://your-internal-registry.com

# Or download packages manually and install from local files
npm install /path/to/downloaded/packages/*
```

## Build & Development Scripts

The project uses these npm scripts:
- `npm run dev` - Development server (runs on port 9002 with Turbopack)
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Configuration Files Required

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.mjs` - PostCSS configuration
- `next.config.ts` - Next.js configuration
- `components.json` - shadcn/ui configuration

## External Service Dependencies

### Image Domains (for Next.js Image component)
The application is configured to allow images from:
- `placehold.co`
- `images.unsplash.com`
- `picsum.photos`

## Notes for Network-Restricted Setup

1. **Node.js and npm/yarn must be pre-installed** in the environment
2. **All npm packages** listed above must be available either through:
   - Internal npm registry
   - Pre-downloaded package files
   - Air-gapped package installation
3. **Image loading** from external domains may not work without network access

## Total Package Count
- **Production dependencies**: ~65 packages
- **Development dependencies**: ~8 packages
- **Total**: ~73 packages (including transitive dependencies)