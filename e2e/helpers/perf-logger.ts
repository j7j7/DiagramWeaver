import fs from "node:fs";
import path from "node:path";

export type StepTiming = {
  step: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  ok: boolean;
  detail?: string;
};

export class PerfLogger {
  private readonly steps: StepTiming[] = [];
  private readonly runStarted = Date.now();
  private stepStarted = 0;
  private currentStep = "";

  constructor(
    private readonly logDir: string,
    private readonly runId: string,
    private readonly meta: Record<string, string | number | boolean>,
  ) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  get logFilePath(): string {
    return path.join(this.logDir, `perf-${this.runId}.log`);
  }

  get jsonFilePath(): string {
    return path.join(this.logDir, `perf-${this.runId}.json`);
  }

  private writeLine(line: string): void {
    fs.appendFileSync(this.logFilePath, `${line}\n`, "utf8");
  }

  log(message: string): void {
    const ts = new Date().toISOString();
    this.writeLine(`[${ts}] ${message}`);
  }

  async step<T>(name: string, fn: () => Promise<T>, detail?: string): Promise<T> {
    this.currentStep = name;
    this.stepStarted = Date.now();
    const startedAt = new Date(this.stepStarted).toISOString();
    this.log(`BEGIN ${name}${detail ? ` — ${detail}` : ""}`);
    try {
      const result = await fn();
      const endedAt = new Date().toISOString();
      const durationMs = Date.now() - this.stepStarted;
      this.steps.push({ step: name, startedAt, endedAt, durationMs, ok: true, detail });
      this.log(`END   ${name} — ${durationMs}ms OK`);
      return result;
    } catch (err) {
      const endedAt = new Date().toISOString();
      const durationMs = Date.now() - this.stepStarted;
      const msg = err instanceof Error ? err.message : String(err);
      this.steps.push({
        step: name,
        startedAt,
        endedAt,
        durationMs,
        ok: false,
        detail: msg,
      });
      this.log(`FAIL  ${name} — ${durationMs}ms — ${msg}`);
      throw err;
    }
  }

  finish(extra?: Record<string, unknown>): void {
    const totalMs = Date.now() - this.runStarted;
    const payload = {
      runId: this.runId,
      finishedAt: new Date().toISOString(),
      totalMs,
      meta: this.meta,
      steps: this.steps,
      ...extra,
    };
    fs.writeFileSync(this.jsonFilePath, JSON.stringify(payload, null, 2), "utf8");
    this.log(`TOTAL ${totalMs}ms (${this.steps.length} steps)`);
    this.log(`JSON ${this.jsonFilePath}`);
  }

  get failedStep(): string {
    const last = [...this.steps].reverse().find((s) => !s.ok);
    return last?.step ?? this.currentStep;
  }
}

export function createPerfLogger(meta: Record<string, string | number | boolean>): PerfLogger {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const logDir = path.resolve(process.cwd(), process.env.E2E_LOG_DIR ?? "e2e/logs");
  const logger = new PerfLogger(logDir, runId, meta);
  logger.log(`Run ${runId}`);
  for (const [k, v] of Object.entries(meta)) {
    logger.log(`  ${k}: ${v}`);
  }
  return logger;
}
