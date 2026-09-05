import type { VerifiedContext } from '../../contracts/src/semantic.js';
import type { SemanticExecutor } from '../../ontology/src/surfaces/dispatch.js';
import { canonicalJson, type JsonValue } from '../../kernel/src/json.js';
import { httpStatus, toPublicFailure } from '../../kernel/src/result.js';
import { PRIVATE_HEADERS, exactOrigin, readBoundedBody, requireJson } from './http-security.js';
export interface PresenceResolver { present(headers: Headers): Promise<VerifiedContext>; }
/** A transport adapter only. All operations, including discovery and reads, use one executor. */
export class SemanticHttpEndpoint {
  constructor(private readonly identity: PresenceResolver, private readonly executor: SemanticExecutor, private readonly origin: string) {}
  async handle(request: Request): Promise<Response> {
    const correlationId = crypto.randomUUID();
    let result;
    try {
      exactOrigin(request.headers.get('Origin'), this.origin); requireJson(request);
      const context = await this.identity.present(request.headers);
      result = await this.executor.execute(await readBoundedBody(request), context);
    } catch (error) { result = toPublicFailure(error); }
    // Request bodies, cookies, evidence, identity and provider exceptions are not logged.
    console.info(JSON.stringify({ event: 'semantic.complete', correlationId, result: result.tag }));
    return new Response(canonicalJson(result as unknown as JsonValue), { status: httpStatus(result), headers: { ...PRIVATE_HEADERS, 'Content-Type': 'application/json', 'X-Correlation-ID': correlationId } });
  }
}
