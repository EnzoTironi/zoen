import { Hono } from 'hono';
import { present, type Door } from '../../../packages/door/src/door.js';
import type { SemanticExecutor } from '../../../packages/ontology/src/surfaces/dispatch.js';
import { PRIVATE_HEADERS } from '../../../packages/adapters/src/http-security.js';
import { SemanticHttpEndpoint } from '../../../packages/adapters/src/semantic-http.js';
export function createEdge(door: Door, executor: SemanticExecutor, publicOrigin: string): Hono {
  const app = new Hono();
  const semantic = new SemanticHttpEndpoint({ present: headers => present(door, headers) }, executor, publicOrigin);
  app.use('*', async (c, next) => { await next(); for (const [name, value] of Object.entries(PRIVATE_HEADERS)) c.header(name, value); });
  app.get('/healthz', c => c.json({ status: 'running', qualification: 'candidate-not-production' }));
  app.all('/api/auth/*', c => door.handler(c.req.raw));
  app.post('/api/semantic', c => semantic.handle(c.req.raw));
  app.notFound(c => c.json({ tag: 'NotFoundOrDenied', code: 'NOT_FOUND_OR_DENIED' }, 404));
  app.onError((_error, c) => c.json({ tag: 'Unavailable', code: 'INTERNAL_FAILURE' }, 503));
  return app;
}
