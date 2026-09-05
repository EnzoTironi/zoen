import { createHash } from 'node:crypto';
import type { Cryptography, Database } from '../../../contracts/src/ports.js';
import { uuid, type UUID, type WorldRef } from '../../../kernel/src/ids.js';
import { canonicalJson } from '../../../kernel/src/json.js';
import { requireThat } from '../../../kernel/src/result.js';
import type {
  CsvExtractProfile,
  ExtractCandidate,
  ExtractInput,
  ExtractResult,
  JsonExtractProfile,
} from './types.js';

const EXTRACTOR_IMPL = 'extract-csv-json-v1';

/**
 * Initial CSV/JSON extraction profiles. Ambiguous numerics without an explicit
 * locale, unsupported date forms, and schema drift quarantine. Valid candidate
 * claims retain row/field coordinates and are deterministic for identical bytes.
 */
export class EvidenceExtractor {
  constructor(
    private readonly db: Database,
    private readonly crypto: Cryptography,
  ) {}

  async extract(input: ExtractInput): Promise<ExtractResult> {
    requireThat(input.bytes.byteLength > 0 && input.bytes.byteLength <= 5_000_000, 'BYTES');
    requireThat(input.mappingVersion.length > 0 && input.mappingVersion.length <= 128, 'MAPPING_VERSION');

    const inputDigest = sha256(input.bytes);
    const parsed =
      input.profile.kind === 'csv'
        ? parseCsv(input.bytes, input.profile, input.mappingVersion)
        : parseJson(input.bytes, input.profile, input.mappingVersion);

    if (parsed.tag === 'Quarantined') {
      return this.persist(input, inputDigest, [], 'quarantined', parsed.reason, digestClaims([]));
    }

    const claims = Object.freeze(parsed.claims.map((c) => Object.freeze({ ...c })));
    const resultDigest = digestClaims(claims);
    return this.persist(input, inputDigest, claims, 'ok', null, resultDigest);
  }

  private async persist(
    input: ExtractInput,
    inputDigest: string,
    claims: readonly ExtractCandidate[],
    state: 'ok' | 'quarantined',
    quarantineReason: string | null,
    resultDigest: string,
  ): Promise<ExtractResult> {
    const sql = await this.db.connect();
    try {
      await sql.query("SELECT set_config('zoen.world_id',$1,true), set_config('zoen.realm',$2,true)", [
        input.world.worldId,
        input.world.realm,
      ]);

      // Content identity: identical bytes + profile → same semantic result.
      const existing = await sql.query<{ run_id: string; result_digest: string; state: string; quarantine_reason: string | null }>(
        `SELECT run_id::text, result_digest, state, quarantine_reason
         FROM ontology.extraction_runs
         WHERE world_id=$1 AND realm=$2 AND input_digest=$3
           AND mapping_version=$4 AND extractor_version=$5 AND profile_kind=$6`,
        [
          input.world.worldId,
          input.world.realm,
          inputDigest,
          input.mappingVersion,
          EXTRACTOR_IMPL,
          input.profile.kind,
        ],
      );
      if (existing[0]) {
        const runId = uuid(existing[0].run_id);
        if (existing[0].state === 'quarantined') {
          return Object.freeze({
            tag: 'Quarantined' as const,
            runId,
            reason: existing[0].quarantine_reason ?? 'QUARANTINED',
            inputDigest,
            resultDigest: existing[0].result_digest,
            firstRun: false,
          });
        }
        const loaded = await sql.query<{
          candidate_id: string;
          row_index: number;
          field_name: string;
          column_index: number;
          raw_text: string;
          parsed_json: unknown;
          mapping_version: string;
          extractor_version: string;
        }>(
          `SELECT candidate_id::text, row_index, field_name, column_index, raw_text, parsed_json,
                  mapping_version, extractor_version
           FROM ontology.extraction_candidates
           WHERE world_id=$1 AND realm=$2 AND run_id=$3
           ORDER BY row_index, column_index, field_name`,
          [input.world.worldId, input.world.realm, runId],
        );
        const claimsOut = loaded.map((row) =>
          Object.freeze({
            candidateId: uuid(row.candidate_id),
            row: row.row_index,
            field: row.field_name,
            column: row.column_index,
            rawText: row.raw_text,
            parsed: row.parsed_json,
            mappingVersion: row.mapping_version,
            extractorVersion: row.extractor_version,
            coordinates: Object.freeze({ row: row.row_index, column: row.column_index }),
          }),
        );
        return Object.freeze({
          tag: 'Ok' as const,
          runId,
          claims: Object.freeze(claimsOut),
          inputDigest,
          resultDigest: existing[0].result_digest,
          firstRun: false,
        });
      }

      const runId = this.crypto.randomId();
      try {
        await sql.query(
          `INSERT INTO ontology.extraction_runs(
             world_id, realm, run_id, evidence_id, capture_id, profile_kind,
             mapping_version, extractor_version, input_digest, result_digest, state, quarantine_reason
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            input.world.worldId,
            input.world.realm,
            runId,
            input.evidenceId ?? null,
            input.captureId ?? null,
            input.profile.kind,
            input.mappingVersion,
            EXTRACTOR_IMPL,
            inputDigest,
            resultDigest,
            state,
            quarantineReason,
          ],
        );
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          // Lost the race — reload the committed semantic result.
          return this.persist(input, inputDigest, claims, state, quarantineReason, resultDigest);
        }
        throw error;
      }

      const persistedClaims: ExtractCandidate[] = [];
      if (state === 'ok') {
        for (const claim of claims) {
          const candidateId = this.crypto.randomId();
          await sql.query(
            `INSERT INTO ontology.extraction_candidates(
               world_id, realm, run_id, candidate_id, row_index, field_name, column_index,
               raw_text, parsed_json, mapping_version, extractor_version
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11)`,
            [
              input.world.worldId,
              input.world.realm,
              runId,
              candidateId,
              claim.row,
              claim.field,
              claim.column,
              claim.rawText,
              canonicalJson(claim.parsed as never),
              claim.mappingVersion,
              claim.extractorVersion,
            ],
          );
          persistedClaims.push(
            Object.freeze({
              ...claim,
              candidateId,
            }),
          );
        }
      }

      if (state === 'quarantined') {
        return Object.freeze({
          tag: 'Quarantined' as const,
          runId,
          reason: quarantineReason ?? 'QUARANTINED',
          inputDigest,
          resultDigest,
          firstRun: true,
        });
      }

      return Object.freeze({
        tag: 'Ok' as const,
        runId,
        claims: Object.freeze(persistedClaims),
        inputDigest,
        resultDigest,
        firstRun: true,
      });
    } finally {
      sql.release();
    }
  }
}

type ParseOk = { tag: 'Ok'; claims: ExtractCandidate[] };
type ParseQ = { tag: 'Quarantined'; reason: string };

function parseCsv(bytes: Uint8Array, profile: CsvExtractProfile, mappingVersion: string): ParseOk | ParseQ {
  requireThat(profile.delimiter === ',' || profile.delimiter === ';' || profile.delimiter === '\t', 'DELIMITER');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { tag: 'Quarantined', reason: 'INVALID_UTF8' };
  }

  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { tag: 'Quarantined', reason: 'EMPTY_CSV' };

  const headers = profile.hasHeader
    ? splitCsvLine(lines[0]!, profile.delimiter)
    : splitCsvLine(lines[0]!, profile.delimiter).map((_, i) => `col_${i}`);
  const dataLines = profile.hasHeader ? lines.slice(1) : lines;

  const claims: ExtractCandidate[] = [];
  const invoiceAmounts = new Map<string, Set<string>>();
  const invoiceIdx = headers.findIndex((h) => h.toLowerCase() === 'invoice');
  const amountIdx = headers.findIndex((h) => {
    const n = h.toLowerCase();
    return n === 'amount' || n === 'value' || n === 'invoice_amount';
  });

  for (let r = 0; r < dataLines.length; r++) {
    const cells = splitCsvLine(dataLines[r]!, profile.delimiter);
    if (invoiceIdx >= 0 && amountIdx >= 0) {
      const inv = cells[invoiceIdx] ?? '';
      const amt = cells[amountIdx] ?? '';
      if (inv.length > 0) {
        const set = invoiceAmounts.get(inv) ?? new Set<string>();
        set.add(amt);
        invoiceAmounts.set(inv, set);
      }
    }
    for (let c = 0; c < headers.length; c++) {
      const field = headers[c] ?? `col_${c}`;
      const raw = cells[c] ?? '';
      const parsed = parseCell(raw, field, profile.locale);
      if (parsed.tag === 'Quarantined') {
        return { tag: 'Quarantined', reason: parsed.reason };
      }
      claims.push({
        candidateId: uuid('00000000-0000-4000-8000-000000000000'), // replaced on persist
        row: profile.hasHeader ? r + 1 : r,
        field,
        column: c,
        rawText: raw,
        parsed: parsed.value,
        mappingVersion,
        extractorVersion: EXTRACTOR_IMPL,
        coordinates: { row: profile.hasHeader ? r + 1 : r, column: c },
      });
    }
  }

  // Same invoice id with two conflicting amount values → quarantine.
  for (const set of invoiceAmounts.values()) {
    if (set.size > 1) {
      return { tag: 'Quarantined', reason: 'CONFLICTING_INVOICE_VALUES' };
    }
  }

  return { tag: 'Ok', claims };
}

function parseJson(bytes: Uint8Array, profile: JsonExtractProfile, mappingVersion: string): ParseOk | ParseQ {
  requireThat(/^[a-f0-9]{64}$/.test(profile.schemaDigest), 'SCHEMA_DIGEST');
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { tag: 'Quarantined', reason: 'INVALID_UTF8' };
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    return { tag: 'Quarantined', reason: 'INVALID_JSON' };
  }
  // Pinned local schema: require object with exact keys listed in profile.requiredKeys when provided.
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { tag: 'Quarantined', reason: 'SCHEMA_DRIFT' };
  }
  const obj = value as Record<string, unknown>;
  if (profile.requiredKeys) {
    for (const key of profile.requiredKeys) {
      if (!(key in obj)) return { tag: 'Quarantined', reason: 'SCHEMA_DRIFT' };
    }
    for (const key of Object.keys(obj)) {
      if (!profile.requiredKeys.includes(key)) return { tag: 'Quarantined', reason: 'SCHEMA_DRIFT' };
    }
  }
  const claims: ExtractCandidate[] = Object.keys(obj)
    .sort()
    .map((field, column) => ({
      candidateId: uuid('00000000-0000-4000-8000-000000000000'),
      row: 0,
      field,
      column,
      rawText: JSON.stringify(obj[field]),
      parsed: obj[field] ?? null,
      mappingVersion,
      extractorVersion: EXTRACTOR_IMPL,
      coordinates: { row: 0, column, path: `$.${field}` },
    }));
  return { tag: 'Ok', claims };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCell(
  raw: string,
  field: string,
  locale: CsvExtractProfile['locale'],
): { tag: 'Ok'; value: unknown } | { tag: 'Quarantined'; reason: string } {
  if (raw === '') return { tag: 'Ok', value: null };

  // Ambiguous dates without explicit ISO form.
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(raw)) {
    return { tag: 'Quarantined', reason: 'AMBIGUOUS_DATE' };
  }

  // Numeric with grouping/decimal separators — requires explicit locale.
  const grouped = /^\d{1,3}([.,]\d{3})+([.,]\d+)?$/.test(raw);
  const decimalSep = /^\d+[.,]\d+$/.test(raw);
  if (grouped || decimalSep) {
    if (locale === 'und') {
      return { tag: 'Quarantined', reason: 'UNDECLARED_NUMERIC_LOCALE' };
    }
    const normalized =
      locale === 'pt-BR'
        ? raw.replace(/\./g, '').replace(',', '.')
        : locale === 'en-US'
          ? raw.replace(/,/g, '')
          : raw;
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      return { tag: 'Quarantined', reason: 'UNSUPPORTED_NUMERIC_LOCALE' };
    }
    return { tag: 'Ok', value: normalized };
  }

  // Simple integer / decimal without grouping
  if (/^-?\d+(\.\d+)?$/.test(raw)) return { tag: 'Ok', value: raw };

  void field;
  return { tag: 'Ok', value: raw };
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function digestClaims(claims: readonly ExtractCandidate[]): string {
  const body = claims.map((c) => ({
    row: c.row,
    field: c.field,
    column: c.column,
    rawText: c.rawText,
    parsed: c.parsed,
    mappingVersion: c.mappingVersion,
    extractorVersion: c.extractorVersion,
    coordinates: c.coordinates,
  }));
  return createHash('sha256').update(canonicalJson(body as never), 'utf8').digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';
}

export { EXTRACTOR_IMPL };
