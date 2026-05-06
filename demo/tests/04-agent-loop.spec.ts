import { test, expect } from '@playwright/test';
import { waitForRunComplete, captureRunId, setCheckbox } from '../helpers/api.js';

test('Scenario 4 — Agent Loop: agent loops to MAX_STEPS (Decision→Tool boundary)', async ({ page }) => {
  await page.goto('/');

  // Enable only agent_loop
  await setCheckbox(page, 'retrieval_noise', false);
  await setCheckbox(page, 'context_truncation', false);
  await setCheckbox(page, 'agent_loop', true);

  await page.locator('textarea').fill('What is RAG and how does it reduce hallucination?');
  await page.getByRole('button', { name: /run agent/i }).click();

  const runId = await captureRunId(page);
  console.log(`[Agent Loop] run_id: ${runId}`);

  // This run will take longer — agent loops to MAX_STEPS (10)
  const trace = await waitForRunComplete(runId, 120_000);
  console.log(`[Agent Loop] completed in ${trace.steps.length} steps`);

  const frame = page.frameLocator('iframe[src*="localhost:5176"]');

  // Final answer should say "Max steps reached"
  const finalAnswer = frame.locator('[data-testid="final-answer"]');
  await finalAnswer.waitFor({ state: 'visible', timeout: 10_000 });
  const answerText = await finalAnswer.textContent();
  expect(answerText).toContain('Max steps reached');

  // Many MCP call steps should exist (repeated tool calls)
  const mcpCallSteps = frame.locator('[data-testid="mcp-call-step"]');
  const mcpCount = await mcpCallSteps.count();
  expect(mcpCount).toBeGreaterThan(1);
  console.log(`[Agent Loop] MCP calls made: ${mcpCount}`);

  // Total steps should be at or near MAX_STEPS (10 agent + N mcp = many cards)
  expect(trace.steps.length).toBeGreaterThanOrEqual(10);

  expect(trace.failure_modes).toContain('agent_loop');
});
