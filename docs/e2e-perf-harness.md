# E2E performance harness (Playwright)

Measures end-to-end editor performance for a fixed canvas workflow: new tab, palette drops, connections, theme apply, resize, pan, delete all objects, close tab. Each step and the full run are timed; results are written under `e2e/logs/`.

## Prerequisites

```bash
npm install
npm run test:e2e:install
```

## Run

**Headless** (default — good for CI and batch runs):

```bash
npm run test:e2e:perf
```

**Headed** (watch the browser):

```bash
npm run test:e2e:perf:headed
```

Or:

```bash
E2E_HEADED=1 npm run test:e2e:perf
```

**Against an already-running dev server** (port 9004 via `dev:test`):

```bash
npm run dev:test
# other terminal:
E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://127.0.0.1:9004 npm run test:e2e:perf:headed
```

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `E2E_BASE_URL` | `http://127.0.0.1:9003` | App URL |
| `E2E_HEADED` | off | `1` / `true` — show browser |
| `E2E_HEADLESS` | off | `1` — force headless |
| `E2E_SKIP_WEB_SERVER` | off | `1` — do not start `npm run dev:test` |
| `E2E_WEB_COMMAND` | `npm run dev:test` | Command when auto-starting server |
| `E2E_DRAG_MODE` | `mobile` | `mobile` = `mobileDrop` on canvas; `playwright` = real mouse drag from sidebar; `activate` = sidebar double-click |
| `E2E_LOG_DIR` | `e2e/logs` | Log output directory |
| `E2E_TRACE` | off | `1` — Playwright trace always on |
| `E2E_VIDEO` | off | `1` — video always on |

## Logs

Each run creates:

- `e2e/logs/perf-<timestamp>.log` — human-readable step log
- `e2e/logs/perf-<timestamp>.json` — machine-readable timings (`steps[].durationMs`, `totalMs`)

Playwright HTML report: `e2e/report/html/` (on failure retains trace/video under `e2e/test-results/`).

## Workflow steps (timed)

1. Open editor
2. File → **+ Tab**
3. Three **Rounded Rectangle** drops
4. **EC2** icon drop
5. Multi-select rectangles → Connect → click EC2
6. Multi-select rectangles → random **Themes** entry
7. **Grid chart** drop
8. **Segmented rectangle** drop + ~2× resize (bottom-right handle)
9. **Agenda** card drop + ~2× resize
10. **Element Feature** drop
11. Right-button canvas pan (several segments)
12. Each canvas node: select → **Delete** key (same as editor shortcut)
13. Close tab (**Don't Save** if prompted)

## Drag modes

- **`mobile`** (default): dispatches the same `mobileDrop` custom event the app uses for touch palette drops. Stable in CI; still exercises `addNode` and render paths.
- **`playwright`**: searches the sidebar and performs a real mouse drag into the canvas (react-dnd HTML5). Closer to desktop UX; can be flakier — use headed mode when debugging.
- **`activate`**: double-clicks the sidebar tile (same as “place at viewport center” activation). **Cards** (`Agenda`, `Element Feature`) always use this path because it is more reliable than drag for card templates.

```bash
E2E_DRAG_MODE=playwright E2E_HEADED=1 npm run test:e2e:perf
```

## Source layout

- `playwright.config.ts` — base URL, webServer, reporters
- `e2e/perf/canvas-workflow.spec.ts` — scenario
- `e2e/helpers/editor-page.ts` — UI actions
- `e2e/helpers/perf-logger.ts` — timing + log files
- `e2e/helpers/palette-items.ts` — palette payload types
