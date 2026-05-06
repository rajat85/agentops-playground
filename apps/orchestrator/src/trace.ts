import fs from 'node:fs';
import path from 'node:path';
import type { RunResult, TraceStep } from './types.js';

const TRACES_DIR = process.env['TRACES_DIR'] ?? path.resolve(process.cwd(), 'data/traces');

export function generateRunId(): string {
  const ts = new Date().toISOString().replaceAll(/[-:T.Z]/g, '').slice(0, 14);
  const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `run_${ts}_${hex}`;
}

export function initTrace(runId: string, task: string, failureModes: string[]): void {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
  const partial: Omit<RunResult, 'final_answer' | 'completed_at'> & { final_answer: null; completed_at: null } = {
    run_id: runId,
    task,
    failure_modes: failureModes,
    steps: [],
    current_status: 'Starting…',
    running: true,
    final_answer: null,
    completed_at: null,
  };
  fs.writeFileSync(path.join(TRACES_DIR, `${runId}.json`), JSON.stringify(partial, null, 2));
}

export function appendTraceStep(runId: string, step: TraceStep): void {
  const filePath = path.join(TRACES_DIR, `${runId}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RunResult;
  data.steps.push(step);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function setStatus(runId: string, status: string): void {
  const filePath = path.join(TRACES_DIR, `${runId}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RunResult;
  data.current_status = status;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function logTrace(result: RunResult): void {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
  const filePath = path.join(TRACES_DIR, `${result.run_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
}

export function readTrace(runId: string): RunResult | null {
  const filePath = path.join(TRACES_DIR, `${runId}.json`);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RunResult;
  } catch {
    return null;
  }
}
