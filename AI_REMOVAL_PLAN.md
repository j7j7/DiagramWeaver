# AI/Ollama/Firebase Removal Plan

## Goal
Remove all references to AI, Ollama, Firebase SDK, and associated libraries without breaking diagram editing, resource browser, or other features.

## Scope

### NPM Packages to Remove
- `firebase` - Firebase SDK (not used in source; includes @firebase/ai)
- `ollama` - Ollama Node client
- `genkit-cli` - Genkit CLI (devDependency)

### Files/Folders to Delete
- `src/ai/` - entire folder (ollama-service, genkit.ts, flows/, service-substitution.ts)
- `src/lib/ollama-config.ts`
- `src/app/api/test-ollama-connection/` - API route
- `docs/OLLAMA_CONFIG.md`

### Code Changes

1. **resource-browser.tsx**
   - Remove AI Diagram Generation UI block (textarea, Generate button, Test Connection, Config editor)
   - Remove imports: generateDiagram, ollamaConfig, Loader (if only used for AI)
   - Remove state: description, isGenerating, isTestingConnection, connectionStatus, config, isEditingConfig
   - Remove onDiagramGenerated from props (optional - can keep as unused for now, or remove from chain)

2. **actions.ts**
   - Remove generateDiagram server action entirely
   - Remove imports from @/ai/*

3. **component-sidebar.tsx**
   - Remove onDiagramGenerated prop from interface and destructuring
   - Remove passing onDiagramGenerated to ResourceBrowser

4. **diagram-editor.tsx**
   - Remove onDiagramGenerated={setDiagramData} from ComponentSidebar

5. **about-dialog.tsx**
   - Remove bullet about "Optional AI features may connect to a locally-running Ollama endpoint"

### Config/Docs to Update
- **launch.sh**: Remove --genkit option and related logic
- **package.json**: Remove firebase, ollama, genkit-cli
- **.gitignore**: Remove .genkit/ and genkit-debug.log* entries (or keep for cleanliness)
- **MEMORY.MD**: Update to remove AI/Ollama/Genkit references
- **requirements.md**: Remove ollama, genkit-cli references
- **WARP.md**: Remove AI/Genkit sections

### Preserved (NOT removed)
- "firebase" as provider key in resource-browser (Firebase cloud platform icons - UI only, not SDK)
- All diagram editing, resource dragging, export, layers, etc.

## Execution Order
1. Remove AI UI and logic from resource-browser
2. Remove generateDiagram from actions.ts
3. Remove onDiagramGenerated from component-sidebar and diagram-editor
4. Delete files/folders
5. Update package.json
6. Update config files and docs
7. Run npm install and typecheck
