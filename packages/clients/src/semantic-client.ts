import { canonicalJson, exactKeys, object, parseJson, text, type JsonValue } from '../../kernel/src/json.js';
import { parseEnvelope, type SemanticEnvelope, type SemanticResult } from '../../contracts/src/semantic.js';
import { failureTags, fail, requireThat, type FailureTag } from '../../kernel/src/result.js';
/** Same envelope, endpoint and outcomes for every non-authoritative client. No business rules here. */
export class SemanticClient {
  constructor(private readonly origin: string, private readonly cookie: string | null = null) {
    const url = new URL(origin); requireThat(url.origin === origin, 'CLIENT_ORIGIN');
    requireThat(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)), 'HTTPS_REQUIRED');
  }
  async invoke(envelope: SemanticEnvelope, signal?: AbortSignal): Promise<SemanticResult> {
    const bytes = new TextEncoder().encode(canonicalJson(envelope as unknown as JsonValue)); parseEnvelope(bytes);
    const headers = new Headers({ 'Content-Type': 'application/json', Origin: this.origin });
    if (this.cookie !== null) headers.set('Cookie', this.cookie);
    let response: Response;
    try { response = await fetch(`${this.origin}/api/semantic`, { method: 'POST', headers, body: bytes, credentials: 'include', redirect: 'error', ...(signal ? { signal } : {}) }); }
    catch { return fail('Unknown', 'TRANSPORT_OUTCOME_UNKNOWN'); }
    // Do not automatically repeat an unknown mutation. Reuse the same op ID and exact
    // intent only after the caller chooses reconciliation; never invent an ID on retry.
    const reader = response.body?.getReader(); if (!reader) return fail('Unavailable', 'EMPTY_RESPONSE');
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.length; if (size > 1_048_576) { await reader.cancel(); return fail('Unavailable', 'RESPONSE_LIMIT'); } chunks.push(chunk.value); }
      const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
      const result = object(parseJson(body)); const tag = text(result['tag']);
      if (tag === 'Ok') { exactKeys(result, ['tag', 'value']); return Object.freeze({ tag, value: result['value']! }); }
      exactKeys(result, ['tag', 'code']); requireThat(failureTags.includes(tag as FailureTag), 'RESPONSE_OUTCOME');
      return fail(tag as FailureTag, text(result['code'], 80));
    } catch { return fail('Unknown', 'RESPONSE_OUTCOME_UNREADABLE'); }
    finally { reader.releaseLock(); }
  }
}
