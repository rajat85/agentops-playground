const ORCHESTRATOR = 'http://localhost:3000';

/**
 * The Prefab UI renders checkboxes as a hidden <input aria-hidden> paired with a
 * <span role="checkbox"> that intercepts pointer events. Playwright's built-in
 * check()/uncheck() resolve to the hidden input and block indefinitely.
 * This helper clicks the visible span directly to toggle state reliably.
 */
export async function setCheckbox(
  page: import('@playwright/test').Page,
  name: string,
  enabled: boolean,
): Promise<void> {
  // Base UI renders: <div><span role="checkbox"/><input aria-hidden name="..."/><label/></div>
  // getByLabel resolves to the hidden input which is blocked by the span. Instead, navigate
  // from the input up to the parent div and click the span sibling.
  const span = page.locator(`input[name="${name}"]`).locator('xpath=../span[@role="checkbox"]');
  const checked = await span.getAttribute('aria-checked');
  if ((checked === 'true') !== enabled) {
    await span.click();
  }
}

export interface TraceStep {
  step: number;
  kind?: 'mcp_init' | 'agent' | 'mcp_call';
  tool_called: string | null;
  tool_result: string | null;
  latency_ms: number;
}

export interface RunResult {
  run_id: string;
  task: string;
  failure_modes: string[];
  steps: TraceStep[];
  current_status: string;
  running: boolean;
  final_answer: string;
  completed_at: string | null;
}

export async function waitForRunComplete(runId: string, timeoutMs = 90_000): Promise<RunResult> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${ORCHESTRATOR}/trace/${runId}`);
    const trace = await res.json() as RunResult;
    if (!trace.running) return trace;
    await new Promise(r => setTimeout(r, 800));
  }
  throw new Error(`Run ${runId} did not complete within ${timeoutMs}ms`);
}

export async function captureRunId(page: import('@playwright/test').Page): Promise<string> {
  await page.waitForFunction(() => {
    const iframe = document.querySelector('iframe');
    return iframe?.src?.includes('run_id=');
  }, { timeout: 15_000 });
  const src = await page.locator('iframe').getAttribute('src');
  const runId = new URL(src!).searchParams.get('run_id');
  if (!runId) throw new Error('run_id not found in iframe src');
  return runId;
}
