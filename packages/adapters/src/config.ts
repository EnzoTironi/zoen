import { KernelError, requireThat } from '../../kernel/src/result.js';
import { secureBaseUrl } from './http-security.js';
export type Environment = Readonly<Record<string, string | undefined>>;
function required(env: Environment, name: string): string { const value = env[name]; if (!value) throw new KernelError('Blocked', `MISSING_${name}`); return value; }
export type Config = Readonly<{ authorityUrl: string; doorUrl: string; authSecret: string; publicOrigin: string; port: number; bucket: string; region: string; bucketOwner: string }>;
function pgUrl(value: string): string {
  const url = new URL(value); requireThat(['postgresql:', 'postgres:'].includes(url.protocol) && url.username !== '' && url.pathname.length > 1, 'DATABASE_URL');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  requireThat(local || ['verify-full', 'verify-ca'].includes(url.searchParams.get('sslmode') ?? ''), 'DATABASE_TLS_REQUIRED');
  return value;
}
export function readConfig(env: Environment): Config {
  for (const prohibited of ['OFFLINE_MODE', 'MOCK_MODE', 'SKIP_AUTH', 'DEV_USER', 'FAKE_PROVIDER', 'AWS_ENDPOINT_URL', 'AWS_ENDPOINT_URL_S3']) if (env[prohibited] !== undefined) throw new KernelError('Blocked', 'UNSUPPORTED_FALLBACK_CONFIGURATION');
  const origin = secureBaseUrl(required(env, 'ZOEN_PUBLIC_ORIGIN')); requireThat(origin.href === `${origin.origin}/`, 'PUBLIC_ORIGIN_PATH');
  // This candidate is restricted to a local real-service qualification installation.
  // Public hosted admission, TLS termination and deployment hardening remain v4 work.
  requireThat(['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname), 'PUBLIC_HOSTING_NOT_QUALIFIED');
  const port = Number(required(env, 'ZOEN_PORT')); requireThat(Number.isInteger(port) && port >= 1024 && port <= 65535, 'PORT_RANGE');
  requireThat(Number(origin.port || (origin.protocol === 'https:' ? '443' : '80')) === port, 'ORIGIN_PORT');
  const authSecret = required(env, 'BETTER_AUTH_SECRET'); requireThat(authSecret.length >= 32, 'AUTH_SECRET_LENGTH');
  const authorityUrl = pgUrl(required(env, 'ZOEN_AUTHORITY_DATABASE_URL')); const doorUrl = pgUrl(required(env, 'ZOEN_DOOR_DATABASE_URL'));
  requireThat(new URL(authorityUrl).username === 'zoen_authority' && new URL(doorUrl).username === 'zoen_door' && authorityUrl !== doorUrl, 'DATABASE_ROLES');
  return Object.freeze({ authorityUrl, doorUrl, authSecret, publicOrigin: origin.origin, port, bucket: required(env, 'ZOEN_EVIDENCE_BUCKET'), region: required(env, 'AWS_REGION'), bucketOwner: required(env, 'ZOEN_BUCKET_OWNER') });
}
