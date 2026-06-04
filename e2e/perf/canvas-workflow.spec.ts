import { test, expect } from "@playwright/test";
import { createPerfLogger } from "../helpers/perf-logger";
import { EditorPage, DROP_POSITIONS } from "../helpers/editor-page";
import { PALETTE } from "../helpers/palette-items";

/**
 * End-to-end canvas performance workflow.
 *
 * Run headed (watch):  E2E_HEADED=1 npm run test:e2e:perf
 * Run headless:        npm run test:e2e:perf
 * Real palette drag:   E2E_DRAG_MODE=playwright E2E_HEADED=1 npm run test:e2e:perf
 * Reuse running app:   E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://127.0.0.1:9003 npm run test:e2e:perf
 */
test.describe("Canvas E2E performance workflow", () => {
  test("full editor session with per-step timings", async ({ page, baseURL }, testInfo) => {
    const logger = createPerfLogger({
      baseURL: baseURL ?? "",
      project: testInfo.project.name,
      headed: process.env.E2E_HEADED === "1" || process.env.E2E_HEADED === "true",
      dragMode: process.env.E2E_DRAG_MODE ?? "mobile",
    });

    const editor = new EditorPage(page, logger);
    let themeName = "";

    try {
      await logger.step("open_editor", () => editor.gotoEditor());

      await logger.step("create_new_tab", () => editor.createNewTab());

      await logger.step("drop_rounded_rectangle_1", () =>
        editor.dropPaletteItem(PALETTE.roundedRectangle, DROP_POSITIONS.rect1),
      );
      await logger.step("drop_rounded_rectangle_2", () =>
        editor.dropPaletteItem(PALETTE.roundedRectangle, DROP_POSITIONS.rect2),
      );
      await logger.step("drop_rounded_rectangle_3", () =>
        editor.dropPaletteItem(PALETTE.roundedRectangle, DROP_POSITIONS.rect3),
      );

      await logger.step("drop_ec2_icon", () =>
        editor.dropPaletteItem(PALETTE.ec2, DROP_POSITIONS.ec2),
      );

      await logger.step("connect_rectangles_to_ec2", () => editor.connectRectsToEc2());

      await logger.step("apply_random_theme_to_rectangles", async () => {
        const rects = editor.nodeIdsFor("Rounded Rectangle");
        await editor.clickNodeScreen(rects[0]!);
        await editor.clickNodeScreen(rects[1]!, "left", { shift: true });
        await editor.clickNodeScreen(rects[2]!, "left", { shift: true });
        themeName = await editor.applyRandomThemeToSelection();
        logger.log(`  theme: ${themeName}`);
      });

      await logger.step("drop_grid_chart", () =>
        editor.dropPaletteItem(PALETTE.gridChart, DROP_POSITIONS.gridChart),
      );

      await logger.step("drop_segmented_rectangle", () =>
        editor.dropPaletteItem(PALETTE.segmentedRectangle, DROP_POSITIONS.segmented),
      );

      await logger.step("resize_segmented_rectangle_2x", async () => {
        const seg = editor.nodeIdsFor("Segmented rectangle")[0];
        if (!seg) throw new Error("Segmented rectangle node missing");
        await editor.resizeNodeToDouble(seg);
      });

      await logger.step("drop_agenda_card", () =>
        editor.dropPaletteItem(PALETTE.agenda, DROP_POSITIONS.agenda),
      );

      await logger.step("resize_agenda_card_2x", async () => {
        const agenda = editor.nodeIdsFor("Agenda")[0];
        if (!agenda) throw new Error("Agenda node missing");
        await editor.resizeNodeToDouble(agenda);
      });

      await logger.step("drop_element_feature", () =>
        editor.dropPaletteItem(PALETTE.elementFeature, DROP_POSITIONS.feature),
      );

      await logger.step("pan_canvas_right_drag", () => editor.panCanvasWithRightDrag());

      const deleted = await logger.step("delete_all_nodes", () => editor.deleteTrackedNodes());
      logger.log(`  deleted: ${deleted}`);

      await logger.step("close_tab", () => editor.closeActiveTab());

      await editor.switchToNewestDiagramTab();
      const remainingOnTab = await page.locator("[data-node-id]").count();
      expect(remainingOnTab).toBe(0);

      logger.finish({ themeName, nodesDeleted: deleted });
    } catch (err) {
      logger.finish({ failedStep: logger.failedStep, error: String(err) });
      throw err;
    }
  });
});
