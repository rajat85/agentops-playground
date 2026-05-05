import type { FailureType } from '../types.js';
import { setFailure } from '../failure-flags.js';

export function injectFailure(type: FailureType): { status: string } {
  setFailure(type);
  return { status: 'applied' };
}
