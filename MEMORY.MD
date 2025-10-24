# MEMORY.MD

## DiagramWeaver Codebase Analysis & WARP.md Creation

### Project Overview
DiagramWeaver is a Next.js 15 application for creating interactive architecture diagrams from JSON input, with AI-powered natural language generation capabilities.

### Key Analysis Findings
- **Tech Stack**: Next.js 15, React DND, Radix UI, TailwindCSS, Google Genkit
- **Architecture**: Component-based with Canvas/Editor separation
- **AI Integration**: Uses Gemini 2.5 Flash for diagram generation from descriptions
- **Features**: Drag & drop, zoom/pan, nested groups, pathfinding, hover info

### WARP.md Creation (2025-10-24)
Created comprehensive WARP.md file including:
- Development commands (dev, build, lint, typecheck, genkit commands)
- Architecture overview with 4 main components
- Data flow explanation
- Component structure mapping
- Type system documentation
- AI integration details
- Styling/theming information
- Feature descriptions
- Development notes for common tasks

### Important Files Analyzed
- `package.json` - Scripts and dependencies
- `src/components/diagram-editor.tsx` - Main orchestrator
- `src/components/editor/editor-canvas.tsx` - Canvas system
- `src/lib/types.ts` - Core interfaces
- `src/ai/flows/generate-diagram-code-from-description.ts` - AI generation
- `docs/blueprint.md` - Design specifications
- Sample diagram structure from `src/lib/sample-diagram.json`

### .gitignore Creation (2025-10-24)
Created comprehensive .gitignore file for the project including:
- Node.js dependencies (node_modules/, package logs)
- Next.js build artifacts (.next/, out/, build/, dist/)
- Environment variables (.env files)
- Firebase and Genkit specific ignores
- OS files (.DS_Store, Thumbs.db)
- Editor files (.vscode/, .idea/)
- Cache and temporary files
- Testing coverage directories

### launch.sh Creation (2025-10-24)
Added `launch.sh` for macOS to streamline testing:
- Validates Node/npm, checks Node >= 18
- Installs deps (npm ci/install) with --fresh-install option
- Kills conflicting processes on :9002, starts Next dev or production
- Optional Genkit server via --genkit, logs to .genkit-dev.log
- Opens browser, waits for server, traps cleanup on exit

### Next Steps for Future Development
- WARP.md is comprehensive and ready for use
- .gitignore properly configured to exclude build artifacts and dependencies
- Covers all major development scenarios
- Includes specific guidance for AI prompt engineering
- Documents complex layout algorithm behavior
