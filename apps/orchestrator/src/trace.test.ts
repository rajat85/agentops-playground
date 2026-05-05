import { generateRunId, logTrace, readTrace } from './trace.js';
import type { RunResult } from './types.js';
import fs from 'fs';
import path from 'path';

const TRACES_DIR = path.resolve(process.cwd(), 'data/traces');

const sampleResult: RunResult = {
  run_id: 'run_test_0001',
  task: 'test task',
  failure_modes: [],
  steps: [],
  final_answer: 'done',
  completed_at: new Date().toISOString(),
};

afterAll(() => {
  const tracePath = path.join(TRACES_DIR, 'run_test_0001.json');
  if (fs.existsSync(tracePath)) fs.unlinkSync(tracePath);
});

test('generateRunId returns correct format', () => {
  const id = generateRunId();
  expect(id).toMatch(/^run_\d{14}_[0-9a-f]{4}$/);
});

test('logTrace writes a file, readTrace reads it back', () => {
  logTrace(sampleResult);
  const read = readTrace('run_test_0001');
  expect(read).not.toBeNull();
  expect(read!.final_answer).toBe('done');
});

test('readTrace returns null for missing run_id', () => {
  expect(readTrace('run_nonexistent')).toBeNull();
});
