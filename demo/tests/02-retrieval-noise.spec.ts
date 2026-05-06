import { test, expect } from '@playwright/test';
import { waitForRunComplete, captureRunId, setCheckbox } from '../helpers/api.js';

// Noise docs injected by the server when retrieval_noise is active
const NOISE_MARKERS = [
  'French Revolution',
  'Photosynthesis',
  'speed of light',
];

test('Scenario 2 — Retrieval Noise: noisy docs degrade answer (Retrieval→Context boundary)', async ({ page }) => {
  await page.goto('/');

  // Enable only retrieval_noise
  await setCheckbox(page, 'retrieval_noise', true);
  await setCheckbox(page, 'context_truncation', false);
  await setCheckbox(page, 'agent_loop', false);

  await page.locator('textarea').fill('What is RAG and how does it reduce hallucination?');
  await page.getByRole('button', { name: /run agent/i }).click();

  const runId = await captureRunId(page);
  console.log(`[Retrieval Noise] run_id: ${runId}`);

  const trace = await waitForRunComplete(runId);
  console.log(`[Retrieval Noise] completed in ${trace.steps.length} steps`);

  const frame = page.frameLocator('iframe[src*="localhost:5176"]');

  // Final answer exists (degraded but present)
  const finalAnswer = frame.locator('[data-testid="final-answer"]');
  await finalAnswer.waitFor({ state: 'visible', timeout: 10_000 });
  const answerText = await finalAnswer.textContent();
  expect(answerText?.trim().length).toBeGreaterThan(0);

  // The MCP call tool result should contain at least one noise document
  const mcpCallSteps = frame.locator('[data-testid="mcp-call-step"]');
  expect(await mcpCallSteps.count()).toBeGreaterThan(0);

  const firstMcpText = await mcpCallSteps.first().textContent();
  const hasNoise = NOISE_MARKERS.some(marker => firstMcpText?.includes(marker));
  expect(hasNoise, `Expected noise doc in tool result. Got: ${firstMcpText?.slice(0, 200)}`).toBe(true);

  expect(trace.failure_modes).toContain('retrieval_noise');
});
