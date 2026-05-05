import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RunResult } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACES_DIR = path.resolve(__dirname, '../../../data/traces');

export function generateRunId(): string {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `run_${ts}_${hex}`;
}

export function logTrace(result: RunResult): void {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
  const filePath = path.join(TRACES_DIR, `${result.run_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
}

export function readTrace(runId: string): RunResult | null {
  const filePath = path.join(TRACES_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RunResult;
}
