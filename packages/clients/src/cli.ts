import { readFile, stat } from 'node:fs/promises';
import { SemanticClient } from './semantic-client.js';
import { parseEnvelope } from '../../contracts/src/semantic.js';
import { canonicalJson, type JsonValue } from '../../kernel/src/json.js';
async function main(): Promise<void> {
  const [origin, requestPath, sessionPath] = process.argv.slice(2);
  if (!origin || !requestPath || !sessionPath) throw new Error('Usage: zoen <origin> <request.json> <session-cookie-file>');
  const metadata = await stat(sessionPath);
  if (!metadata.isFile() || (process.platform !== 'win32' && (metadata.mode & 0o077) !== 0) || metadata.size > 8192) throw new Error('Session file must be private (0600) and bounded');
  const cookie = (await readFile(sessionPath, 'utf8')).trim();
  if (/\r|\n/.test(cookie) || !cookie.includes('=')) throw new Error('Invalid session cookie file');
  const request = await readFile(requestPath); const envelope = parseEnvelope(request);
  const result = await new SemanticClient(origin, cookie).invoke(envelope, AbortSignal.timeout(20_000));
  console.log(canonicalJson(result as unknown as JsonValue));
  if (result.tag !== 'Ok') process.exitCode = 1;
}
main().catch(() => { console.error('CLI failed. Check the origin, private session file and request contract.'); process.exitCode = 1; });
