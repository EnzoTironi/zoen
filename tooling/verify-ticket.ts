/**
 * ZN-0005 — evidence-bound pull-request completion.
 * VerifyTicket(ticketId, commit, profile) -> EvidenceReport | MissingPrerequisite
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = resolve(HERE, '..');
export const SCHEMA_VERSION = 'spec-000.verify-ticket.v1';
export const DISABLED_ROUTE = 'ticket-acceptance-and-merge';
export const FIXTURE_SEED = 'zn-0005-verify-seed-v1';

export type CheckEvidence = {
  id: string;
  layer: string;
  status: 'passed' | 'failed' | 'skipped' | 'missing';
  executedCount: number;
  skippedCount: number;
  sourceCommit: string;
  lockDigest: string;
  artifact?: string;
  sha256?: string;
  observations?: string[];
};

export type ReviewEvidence = {
  reviewer: string;
  decision: 'approved' | 'rejected' | 'pending';
  sourceCommit: string;
  lockDigest: string;
};

export type TicketEvidence = {
  schemaVersion: string;
  ticketId: string;
  sourceCommit: string;
  lockDigest: string;
  profile: string;
  outcome: 'passed' | 'rejected' | 'MissingPrerequisite';
  author: string;
  review: ReviewEvidence;
  checks: CheckEvidence[];
  fixtureSeed: string;
  commands: string[];
  genericBuildGreen?: boolean;
};

export type VerifyResult =
  | { ok: true; evidence: TicketEvidence }
  | {
      ok: false;
      kind: 'MissingPrerequisite' | 'Rejected';
      missingCheckIds?: string[];
      reasons: string[];
      disabledRoute: string;
      evidence?: TicketEvidence;
    };

type CatalogTicket = {
  id: string;
  risk: string;
  review: string;
  checks: Array<{ id: string; layer: string; oracle: string }>;
  depends_on: string[];
  test_file: string;
};

function sha256Bytes(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const o = value as Record<string, unknown>;
  return '{' + Object.keys(o).sort().map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

export function readCatalog(root: string = DEFAULT_ROOT): { tickets: CatalogTicket[] } {
  return JSON.parse(readFileSync(join(root, 'planning/catalog.json'), 'utf8')) as {
    tickets: CatalogTicket[];
  };
}

export function getTicket(ticketId: string, root: string = DEFAULT_ROOT): CatalogTicket {
  const ticket = readCatalog(root).tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error(`Unknown ticket: ${ticketId}`);
  return ticket;
}

export function gitHead(root: string = DEFAULT_ROOT): string {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Unable to resolve source commit');
  return r.stdout.trim();
}

export function lockDigest(root: string = DEFAULT_ROOT): string {
  const candidates = [
    join(root, 'pnpm-lock.yaml'),
    join(root, 'execution-lock.json'),
    join(root, 'admissions/spec-000/execution-lock.json'),
  ];
  const h = createHash('sha256');
  let any = false;
  for (const p of candidates) {
    if (existsSync(p)) {
      h.update(p);
      h.update(readFileSync(p));
      any = true;
    }
  }
  if (!any) throw new Error('No lock artifacts present');
  return h.digest('hex');
}

/**
 * Evaluate observed check evidence against catalog ownership.
 * A green generic build cannot replace missing ticket checks.
 */
export function verifyTicket(options: {
  ticketId: string;
  root?: string;
  profile: string;
  sourceCommit?: string;
  lockDigest?: string;
  author?: string;
  observedChecks: CheckEvidence[];
  review?: Partial<ReviewEvidence>;
  genericBuildGreen?: boolean;
  fixtureSeed?: string;
  commands?: string[];
}): VerifyResult {
  const root = options.root ?? DEFAULT_ROOT;
  const ticket = getTicket(options.ticketId, root);
  const sourceCommit = options.sourceCommit ?? gitHead(root);
  const digest = options.lockDigest ?? lockDigest(root);
  const author = options.author ?? 'implementation-agent';
  const required = ticket.checks;
  const observed = options.observedChecks;
  const reasons: string[] = [];
  const missingCheckIds: string[] = [];

  if (observed.length === 0) {
    reasons.push('zero-test run: no observed checks');
  }

  const byId = new Map<string, CheckEvidence>();
  for (const c of observed) {
    if (byId.has(c.id)) reasons.push(`duplicate check evidence: ${c.id}`);
    byId.set(c.id, c);
  }

  for (const req of required) {
    const got = byId.get(req.id);
    if (!got) {
      missingCheckIds.push(req.id);
      reasons.push(`missing check ID: ${req.id}`);
      continue;
    }
    if (got.status === 'skipped' || got.skippedCount !== 0) {
      reasons.push(`skipped required check: ${req.id}`);
    }
    if (got.status !== 'passed') {
      reasons.push(`check not passed: ${req.id} status=${got.status}`);
    }
    if (got.executedCount <= 0) {
      reasons.push(`empty execution count: ${req.id}`);
    }
    if (got.layer !== req.layer) {
      reasons.push(`wrong layer for ${req.id}: ${got.layer} != ${req.layer}`);
    }
    if (got.sourceCommit !== sourceCommit) {
      reasons.push(`mixed commit on ${req.id}`);
    }
    if (got.lockDigest !== digest) {
      reasons.push(`mixed lock digest on ${req.id}`);
    }
  }

  // Extra checks not in catalog are ignored for acceptance but recorded
  if (options.genericBuildGreen && missingCheckIds.length > 0) {
    reasons.push('green generic build cannot replace missing ticket checks');
  }

  const review: ReviewEvidence = {
    reviewer: options.review?.reviewer ?? '',
    decision: options.review?.decision ?? 'pending',
    sourceCommit: options.review?.sourceCommit ?? sourceCommit,
    lockDigest: options.review?.lockDigest ?? digest,
  };

  if (ticket.review === 'independent-required' || ticket.risk === 'critical') {
    if (!review.reviewer || review.reviewer === author) {
      reasons.push('independent reviewer required');
    }
    if (review.decision !== 'approved') {
      reasons.push('critical ticket lacks approved independent review');
    }
    if (review.sourceCommit !== sourceCommit || review.lockDigest !== digest) {
      reasons.push('review is stale relative to commit/lock');
    }
  }

  const evidence: TicketEvidence = {
    schemaVersion: SCHEMA_VERSION,
    ticketId: ticket.id,
    sourceCommit,
    lockDigest: digest,
    profile: options.profile,
    outcome: reasons.length ? 'rejected' : 'passed',
    author,
    review,
    checks: observed,
    fixtureSeed: options.fixtureSeed ?? FIXTURE_SEED,
    commands: options.commands ?? [`verify:ticket --ticket ${ticket.id}`],
    genericBuildGreen: options.genericBuildGreen ?? false,
  };

  if (reasons.length) {
    return {
      ok: false,
      kind: missingCheckIds.length ? 'Rejected' : 'Rejected',
      missingCheckIds: missingCheckIds.length ? missingCheckIds : undefined,
      reasons,
      disabledRoute: DISABLED_ROUTE,
      evidence,
    };
  }

  return { ok: true, evidence };
}

export function writeEvidence(evidence: TicketEvidence, outPath: string): void {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(evidence, null, 2) + '\n');
}

export function evidenceDigest(evidence: TicketEvidence): string {
  return sha256Bytes(stableStringify(evidence));
}

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

function main(argv: string[]): number {
  const args = parseArgs(argv);
  const ticketId = String(args.ticket ?? '');
  const profile = String(args.profile ?? 'admitted-static-profile');
  if (!ticketId) {
    process.stderr.write('Usage: verify-ticket --ticket ZN-XXXX --profile <profile> [--evidence path]\n');
    return 2;
  }

  // Default: no observed checks => reject with all missing IDs (fail closed).
  // Callers/CI must pass --evidence with observed results.
  let observed: CheckEvidence[] = [];
  const evidencePath = typeof args.evidence === 'string' ? args.evidence : '';
  if (evidencePath) {
    const raw = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      checks?: CheckEvidence[];
      author?: string;
      review?: Partial<ReviewEvidence>;
      genericBuildGreen?: boolean;
    };
    observed = raw.checks ?? [];
    const result = verifyTicket({
      ticketId,
      profile,
      observedChecks: observed,
      author: raw.author,
      review: raw.review,
      genericBuildGreen: raw.genericBuildGreen,
      commands: [`verify:ticket --ticket ${ticketId} --profile ${profile}`],
    });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (typeof args.out === 'string' && result.evidence) writeEvidence(result.evidence, args.out);
    return result.ok ? 0 : 1;
  }

  const result = verifyTicket({
    ticketId,
    profile,
    observedChecks: [],
    genericBuildGreen: args['generic-build'] === true,
    commands: [`verify:ticket --ticket ${ticketId} --profile ${profile}`],
  });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  return result.ok ? 0 : 1;
}

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry === thisFile) {
  process.exit(main(process.argv.slice(2)));
}
