import type { Page, Locator } from "@playwright/test";
import type { PaletteDropItem } from "./palette-items";
import type { PerfLogger } from "./perf-logger";

const CANVAS_TEST_ID = "editor-canvas";
const ITEM_TYPES_DIAGRAM_NODE = "diagram_node";

/** Diagram-space drop offsets used across the workflow (grid-snapped friendly). */
export const DROP_POSITIONS = {
  rect1: { x: 120, y: 120 },
  rect2: { x: 320, y: 120 },
  rect3: { x: 520, y: 120 },
  ec2: { x: 320, y: 280 },
  gridChart: { x: 80, y: 420 },
  segmented: { x: 400, y: 420 },
  agenda: { x: 80, y: 560 },
  feature: { x: 400, y: 560 },
} as const;

export class EditorPage {
  private nodeCount = 0;
  private readonly nodeIdsByLabel = new Map<string, string[]>();

  constructor(
    readonly page: Page,
    readonly logger: PerfLogger,
  ) {}

  canvas(): Locator {
    return this.page.getByTestId(CANVAS_TEST_ID);
  }

  async gotoEditor(): Promise<void> {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
    await this.canvas().waitFor({ state: "visible", timeout: 120_000 });
    await this.page.getByText("Loading tabs…").waitFor({ state: "hidden", timeout: 120_000 }).catch(() => {});
    await this.page.getByPlaceholder("Search resources...").waitFor({ state: "visible", timeout: 120_000 });
    await this.dismissTutorialOverlay();
  }

  /** Close interactive tutorial if it blocks menus (first visit). */
  async dismissTutorialOverlay(): Promise<void> {
    const skip = this.page.getByRole("button", { name: "Skip tutorial" });
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await this.page.waitForTimeout(300);
      return;
    }
    const close = this.page.getByRole("button", { name: "Close tutorial" });
    if (await close.isVisible().catch(() => false)) {
      await close.click();
      await this.page.waitForTimeout(300);
    }
  }

  async createNewTab(): Promise<void> {
    await this.page.getByRole("menuitem", { name: "File" }).click();
    await this.page.getByRole("menuitem", { name: "+ Tab" }).click();
    await this.page.getByText("New Tab").waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
    await this.switchToNewestDiagramTab();
    this.nodeCount = (await this.getNodeIds()).length;
    this.nodeIdsByLabel.clear();
  }

  /** Activate the last non-tutorial diagram tab (new tabs are appended). */
  async switchToNewestDiagramTab(): Promise<void> {
    const tabs = this.page.locator(".rounded-t-md.cursor-pointer").filter({
      hasNot: this.page.getByText("tutorial", { exact: true }),
    });
    const count = await tabs.count();
    if (count === 0) throw new Error("No diagram tabs found");
    await tabs.nth(count - 1).click();
    await this.page.waitForTimeout(200);
  }

  /**
   * Drop a palette item onto the canvas.
   * `E2E_DRAG_MODE=playwright` uses real mouse drag (react-dnd HTML5 backend).
   * Default / `mobile` uses the app's `mobileDrop` path (reliable on CI).
   */
  async dropPaletteItem(
    item: PaletteDropItem,
    diagramPos: { x: number; y: number },
  ): Promise<void> {
    const mode = (process.env.E2E_DRAG_MODE ?? "mobile").toLowerCase();
    if (mode === "playwright") {
      await this.dropViaPlaywrightDrag(item.label, diagramPos);
      return;
    }
    if (mode === "activate" || item.category === "cards") {
      await this.dropViaSidebarDoubleClick(item, diagramPos);
      return;
    }
    await this.dropViaMobileEvent(item, diagramPos);
  }

  /** Double-click sidebar item — uses `pastePaletteItem` with explicit diagram position. */
  async dropViaSidebarDoubleClick(
    item: PaletteDropItem,
    diagramPos: { x: number; y: number },
  ): Promise<void> {
    const before = await this.getNodeIds();
    await this.searchResource(item.label);
    const tile = this.page.locator(".cursor-move").filter({ hasText: item.label }).first();
    await tile.waitFor({ state: "visible", timeout: 30_000 });
    await tile.dblclick();
    await this.waitForNewNodes(before);
    await this.trackNewNodes(item.label, before);
  }

  async dropViaMobileEvent(
    item: PaletteDropItem,
    diagramPos: { x: number; y: number },
  ): Promise<void> {
    const before = await this.getNodeIds();
    const client = await this.diagramToClient(diagramPos.x, diagramPos.y);
    await this.page.evaluate(
      ({ item, clientX, clientY, itemType }) => {
        const canvas = document.querySelector('[data-testid="editor-canvas"]');
        if (!canvas) throw new Error("editor-canvas not found");
        canvas.dispatchEvent(
          new CustomEvent("mobileDrop", {
            detail: { item, clientX, clientY, itemType },
          }),
        );
      },
      { item, ...client, itemType: ITEM_TYPES_DIAGRAM_NODE },
    );
    await this.waitForNewNodes(before);
    await this.trackNewNodes(item.label, before);
  }

  async dropViaPlaywrightDrag(label: string, diagramPos: { x: number; y: number }): Promise<void> {
    const before = await this.getNodeIds();
    await this.searchResource(label);
    const source = this.page.locator(".cursor-move").filter({ hasText: label }).first();
    await source.waitFor({ state: "visible", timeout: 30_000 });
    const canvas = this.canvas();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas bounding box missing");
    const transform = await this.getCanvasTransform();
    const targetX = box.x + transform.x + diagramPos.x * transform.k;
    const targetY = box.y + transform.y + diagramPos.y * transform.k;
    const srcBox = await source.boundingBox();
    if (!srcBox) throw new Error(`palette item "${label}" not visible`);
    await this.page.mouse.move(srcBox.x + srcBox.width / 2, srcBox.y + srcBox.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(targetX, targetY, { steps: 24 });
    await this.page.mouse.up();
    await this.waitForNewNodes(before);
    await this.trackNewNodes(label, before);
  }

  private async trackNewNodes(label: string, before: string[]): Promise<void> {
    const after = await this.getNodeIds();
    const added = after.filter((id) => !before.includes(id));
    if (added.length === 0) return;
    const list = this.nodeIdsByLabel.get(label) ?? [];
    list.push(...added);
    this.nodeIdsByLabel.set(label, list);
  }

  nodeIdsFor(label: string): string[] {
    return [...(this.nodeIdsByLabel.get(label) ?? [])];
  }

  allTrackedNodeIds(): string[] {
    return [...this.nodeIdsByLabel.values()].flat();
  }

  async searchResource(name: string): Promise<void> {
    const input = this.page.getByPlaceholder("Search resources...");
    await input.fill(name);
    await this.page.getByTitle("Expand all").click();
    await this.page.waitForTimeout(300);
  }

  async clearResourceSearch(): Promise<void> {
    await this.page.getByPlaceholder("Search resources...").fill("");
  }

  private readCanvasTransform(): Promise<{
    x: number;
    y: number;
    k: number;
    rect: { left: number; top: number };
  }> {
    return this.page.evaluate(() => {
      const canvas = document.querySelector('[data-testid="editor-canvas"]') as HTMLElement | null;
      if (!canvas) throw new Error("editor-canvas not found");
      const layer = canvas.querySelector("[data-diagram-layer]") as HTMLElement | null;
      const rect = canvas.getBoundingClientRect();
      const base = { rect: { left: rect.left, top: rect.top } };
      if (!layer) return { x: 0, y: 0, k: 1, ...base };
      const m = getComputedStyle(layer).transform;
      if (!m || m === "none") return { x: 0, y: 0, k: 1, ...base };
      const dm = new DOMMatrix(m);
      return { x: dm.e, y: dm.f, k: dm.a || 1, ...base };
    });
  }

  private async diagramToClient(x: number, y: number): Promise<{ clientX: number; clientY: number }> {
    const { x: tx, y: ty, k, rect } = await this.readCanvasTransform();
    return {
      clientX: rect.left + tx + x * k,
      clientY: rect.top + ty + y * k,
    };
  }

  async getCanvasTransform(): Promise<{ x: number; y: number; k: number }> {
    const { x, y, k } = await this.readCanvasTransform();
    return { x, y, k };
  }

  private async waitForNewNodes(before: string[], timeoutMs = 20_000): Promise<string[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const after = await this.getNodeIds();
      const added = after.filter((id) => !before.includes(id));
      if (added.length > 0) {
        this.nodeCount = after.length;
        return added;
      }
      await this.page.waitForTimeout(80);
    }
    throw new Error(`No new node after drop (had ${before.length}, still ${await this.getNodeIds().then((x) => x.length)})`);
  }

  async getNodeIds(): Promise<string[]> {
    return this.page.locator("[data-node-id]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-node-id")).filter((id): id is string => !!id),
    );
  }

  async clickNodeScreen(nodeId: string, button: "left" | "right" = "left", modifiers?: { shift?: boolean }): Promise<void> {
    const { x, y } = await this.nodeScreenCenter(nodeId);
    if (modifiers?.shift) await this.page.keyboard.down("Shift");
    await this.page.mouse.click(x, y, { button });
    if (modifiers?.shift) await this.page.keyboard.up("Shift");
  }

  private async nodeScreenCenter(nodeId: string): Promise<{ x: number; y: number }> {
    const el = this.page.locator(`[data-node-id="${nodeId}"]`);
    await el.waitFor({ state: "visible", timeout: 15_000 });
    const box = await el.boundingBox();
    if (!box) throw new Error(`Node ${nodeId} has no bounding box`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async contextMenuClick(text: string): Promise<void> {
    const item = this.page.locator("button").filter({ hasText: text }).first();
    await item.waitFor({ state: "visible", timeout: 10_000 });
    await item.click();
  }

  async connectViaToolbar(): Promise<void> {
    const connectBtn = this.page.locator("button").filter({
      has: this.page.locator("svg.lucide-link"),
    });
    await connectBtn.first().click({ timeout: 10_000 });
  }

  async connectRectsToEc2(): Promise<void> {
    const rects = this.nodeIdsFor("Rounded Rectangle");
    const ec2Ids = this.nodeIdsFor("EC2");
    if (rects.length < 3) throw new Error(`Expected 3 rectangles, got ${rects.length}`);
    if (ec2Ids.length < 1) throw new Error("Expected EC2 node");
    const [r1, r2, r3] = rects;
    const ec2 = ec2Ids[0]!;
    await this.clickNodeScreen(r1!);
    await this.clickNodeScreen(r2!, "left", { shift: true });
    await this.clickNodeScreen(r3!, "left", { shift: true });
    await this.connectViaToolbar();
    await this.clickNodeScreen(ec2);
    await this.page.waitForTimeout(400);
  }

  async applyRandomThemeToSelection(): Promise<string> {
    await this.dismissTutorialOverlay();
    await this.page.getByRole("button", { name: /Themes/i }).click();
    const items = this.page.locator('[role="menuitem"]');
    const count = await items.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = (await items.nth(i).innerText()).trim();
      if (t && !t.startsWith("Hue") && t !== "Theme editor") names.push(t.split("\n")[0]!);
    }
    if (names.length === 0) throw new Error("No themes in Themes menu");
    const pick = names[Math.floor(Math.random() * names.length)]!;
    await this.page.getByRole("menuitem").filter({ hasText: pick }).first().click();
    await this.page.keyboard.press("Escape");
    return pick;
  }

  async selectNodeById(nodeId: string): Promise<void> {
    await this.page.keyboard.press("Escape");
    await this.page.waitForTimeout(150);
    const node = this.page.locator(`[data-node-id="${nodeId}"]`);
    await node.waitFor({ state: "visible", timeout: 15_000 });
    await node.scrollIntoViewIfNeeded();
    const box = await node.boundingBox();
    if (!box) throw new Error(`Node ${nodeId} has no bounding box`);
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.waitForTimeout(200);
    await this.page.mouse.move(box.x + box.width - 2, box.y + box.height - 2);
    await this.page.waitForTimeout(200);
  }

  /** Drag bottom-right resize handle ~2× width and height in diagram space. */
  async resizeSelectedToDouble(): Promise<void> {
    const handle = this.page.locator('.dw-resize-knob[data-handle="bottom-right"]').last();
    await handle.waitFor({ state: "visible", timeout: 10_000 });
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("resize handle not found");
    const transform = await this.getCanvasTransform();
    const dragScreenX = 140 * transform.k;
    const dragScreenY = 100 * transform.k;
    const sx = handleBox.x + handleBox.width / 2;
    const sy = handleBox.y + handleBox.height / 2;
    await this.page.mouse.move(sx, sy);
    await this.page.mouse.down();
    await this.page.mouse.move(sx + dragScreenX, sy + dragScreenY, { steps: 20 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }

  /** Fallback when BR knob is absent (some card nodes): drag the node frame's bottom-right corner. */
  async resizeCardViaBBoxCorner(nodeId: string): Promise<void> {
    const node = this.page.locator(`[data-node-id="${nodeId}"]`);
    const box = await node.boundingBox();
    if (!box) throw new Error(`No bbox for ${nodeId}`);
    const transform = await this.getCanvasTransform();
    const sx = box.x + box.width - 4;
    const sy = box.y + box.height - 4;
    const dragX = 120 * transform.k;
    const dragY = 90 * transform.k;
    await this.page.mouse.move(sx, sy);
    await this.page.mouse.down();
    await this.page.mouse.move(sx + dragX, sy + dragY, { steps: 20 });
    await this.page.mouse.up();
    await this.page.waitForTimeout(300);
  }

  async resizeNodeToDouble(nodeId: string): Promise<void> {
    await this.selectNodeById(nodeId);
    const knob = this.page.locator('.dw-resize-knob[data-handle="bottom-right"]').last();
    if ((await knob.count()) > 0) {
      await this.resizeSelectedToDouble();
      return;
    }
    await this.resizeCardViaBBoxCorner(nodeId);
  }

  async panCanvasWithRightDrag(): Promise<void> {
    const canvas = this.canvas();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("canvas box missing");
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const moves: Array<{ dx: number; dy: number }> = [
      { dx: 120, dy: 0 },
      { dx: 0, dy: 90 },
      { dx: -160, dy: 0 },
      { dx: 0, dy: -70 },
      { dx: 80, dy: 40 },
    ];
    let x = cx;
    let y = cy;
    await this.page.mouse.move(x, y);
    await this.page.mouse.down({ button: "right" });
    for (const m of moves) {
      x += m.dx;
      y += m.dy;
      await this.page.mouse.move(x, y, { steps: 12 });
    }
    await this.page.mouse.up({ button: "right" });
    await this.page.waitForTimeout(200);
  }

  async deleteTrackedNodes(): Promise<number> {
    await this.switchToNewestDiagramTab();
    let deleted = 0;
    for (const id of [...this.allTrackedNodeIds()].reverse()) {
      const el = this.page.locator(`[data-node-id="${id}"]`);
      if ((await el.count()) === 0) continue;
      const box = await el.boundingBox();
      if (!box) continue;
      await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await this.page.waitForTimeout(100);
      await this.page.keyboard.press("Delete");
      await this.page.waitForTimeout(200);
      deleted++;
    }
    return deleted;
  }

  async closeActiveTab(): Promise<void> {
    const tabs = this.page.locator(".rounded-t-md.cursor-pointer").filter({
      hasNot: this.page.getByText("tutorial", { exact: true }),
    });
    const count = await tabs.count();
    const tab = tabs.nth(count - 1);
    await tab.locator("button[aria-label^='Close']").click();
    const dontSave = this.page.getByRole("button", { name: "Don't Save" });
    if (await dontSave.isVisible().catch(() => false)) {
      await dontSave.click();
    }
  }
}
