import { test, expect } from '@playwright/test';
import { waitForRunComplete, captureRunId, setCheckbox } from '../helpers/api.js';

test('Scenario 3 — Context Truncation: truncated context breaks reasoning (Context→Decision boundary)', async ({ page }) => {
  await page.goto('/');

  // Enable only context_truncation
  await setCheckbox(page, 'retrieval_noise', false);
  await setCheckbox(page, 'context_truncation', true);
  await setCheckbox(page, 'agent_loop', false);

  await page.locator('textarea').fill('What is RAG and how does it reduce hallucination?');
  await page.getByRole('button', { name: /run agent/i }).click();

  const runId = await captureRunId(page);
  console.log(`[Context Truncation] run_id: ${runId}`);

  const trace = await waitForRunComplete(runId);
  console.log(`[Context Truncation] completed in ${trace.steps.length} steps`);

  const frame = page.frameLocator('iframe[src*="localhost:5176"]');

  // Run should complete (not loop) — context truncation causes confused reasoning, not infinite loop
  const finalAnswer = frame.locator('[data-testid="final-answer"]');
  await finalAnswer.waitFor({ state: 'visible', timeout: 10_000 });

  // Multiple agent steps should exist — truncation may cause extra LLM calls
  const agentSteps = frame.locator('[data-testid="agent-step"]');
  expect(await agentSteps.count()).toBeGreaterThan(0);

  // Should NOT have hit MAX_STEPS (context truncation usually resolves, unlike agent_loop)
  expect(trace.steps.length).toBeLessThan(20);

  expect(trace.failure_modes).toContain('context_truncation');
});
