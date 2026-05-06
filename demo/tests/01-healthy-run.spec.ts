import { test, expect } from '@playwright/test';
import { waitForRunComplete, captureRunId, setCheckbox } from '../helpers/api.js';

test('Scenario 1 — Healthy Run: clean retrieval → reasoning → answer', async ({ page }) => {
  await page.goto('/');

  // Ensure all failure modes are off
  await setCheckbox(page, 'retrieval_noise', false);
  await setCheckbox(page, 'context_truncation', false);
  await setCheckbox(page, 'agent_loop', false);

  // Use default task
  await page.locator('textarea').fill('What is RAG and how does it reduce hallucination?');

  // Start the run
  await page.getByRole('button', { name: /run agent/i }).click();

  // Capture the run_id from the iframe URL
  const runId = await captureRunId(page);
  console.log(`[Healthy Run] run_id: ${runId}`);

  // Wait for the agent to complete via API
  const trace = await waitForRunComplete(runId);
  console.log(`[Healthy Run] completed in ${trace.steps.length} steps`);

  // Assert in the embedded React iframe
  const frame = page.frameLocator('iframe[src*="localhost:5176"]');

  // Final answer must be visible and non-empty
  const finalAnswer = frame.locator('[data-testid="final-answer"]');
  await finalAnswer.waitFor({ state: 'visible', timeout: 10_000 });
  const answerText = await finalAnswer.textContent();
  expect(answerText?.trim().length).toBeGreaterThan(20);

  // At least one MCP call step must exist (retrieve_docs was called)
  const mcpCallSteps = frame.locator('[data-testid="mcp-call-step"]');
  expect(await mcpCallSteps.count()).toBeGreaterThan(0);

  // Status pill must be gone (run completed)
  await expect(frame.locator('[data-testid="status-pill"]')).toHaveCount(0);

  // No failure modes on this run
  expect(trace.failure_modes).toHaveLength(0);
});
