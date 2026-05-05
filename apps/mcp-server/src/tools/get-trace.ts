import fs from 'fs';
import path from 'path';

const TRACES_DIR = process.env['TRACES_DIR'] ?? path.resolve(process.cwd(), 'data/traces');

export function getTrace(runId: string): { trace: unknown } {
  const filePath = path.join(TRACES_DIR, `${runId}.json`);
  try {
    return { trace: JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
  } catch {
    return { trace: null };
  }
}
