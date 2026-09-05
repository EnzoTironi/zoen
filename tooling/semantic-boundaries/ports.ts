import type { NoBypassReport } from './types.js';

/** Static checker port — no runtime DB or network. */
export interface NoBypassGraphPort {
  check(root: string, options?: { fixtureSeed?: string }): NoBypassReport;
}
