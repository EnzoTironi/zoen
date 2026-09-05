import { betterAuth } from 'better-auth';
import type { Pool } from 'pg';
import type { VerifiedContext } from '../../contracts/src/semantic.js';
import { uuid } from '../../kernel/src/ids.js';
import { KernelError } from '../../kernel/src/result.js';
export function createDoor(pool: Pool, baseURL: string, secret: string) {
  return betterAuth({ database: pool, baseURL, secret, trustedOrigins: [baseURL],
    emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, autoSignIn: true },
    // This proves control of a password account, NOT ownership of an email address.
    // No invitations, mailbox-based grants or financial effects are enabled here.
    session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
    advanced: { database: { generateId: 'uuid' }, cookiePrefix: 'zoen', useSecureCookies: baseURL.startsWith('https:') },
    rateLimit: { enabled: true, window: 60, max: 40 },
  });
}
export type Door = ReturnType<typeof createDoor>;
/** Authenticated server context is produced only from Better Auth's actual session lookup. */
export async function present(door: Door, headers: Headers): Promise<VerifiedContext> {
  const session = await door.api.getSession({ headers });
  if (!session) throw new KernelError('Denied', 'AUTHENTICATION_REQUIRED');
  const principalId = uuid(session.user.id);
  return Object.freeze({ principalId, actorId: principalId, sessionId: session.session.id,
    authenticatedAt: session.session.createdAt.toISOString(), assurance: 'authenticated', appSessionId: null, transport: 'web' });
}
