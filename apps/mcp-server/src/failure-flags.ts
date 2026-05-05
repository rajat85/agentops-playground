import type { FailureType } from './types.js';

const active = new Set<FailureType>();

export function setFailure(type: FailureType): void {
  active.add(type);
}

export function hasFailure(type: FailureType): boolean {
  return active.has(type);
}

export function clearFailures(): void {
  active.clear();
}
