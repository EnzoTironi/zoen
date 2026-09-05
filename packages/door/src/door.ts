/**
 * Door — Better Auth behind a presence-only port.
 * Presence proves control of an identity account. It never grants World membership,
 * purpose grants, or Ontology authority. Email/display name are never primary identity.
 */
import { betterAuth } from 'better-auth';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { VerifiedContext } from '../../contracts/src/semantic.js';
import { uuid, type UUID } from '../../kernel/src/ids.js';
import { fail, ok, type Result } from '../../kernel/src/result.js';

export type PresenceAssertion = Readonly<{
  headers: Headers;
  /** Expected audience / base URL binding for this Door instance. */
  audience: string;
}>;

export type PresenceProof = Readonly<{
  tag: 'PresenceProof';
  subjectId: string;
  principalId: UUID;
  sessionId: string;
  sessionToken: string;
  audience: string;
  authenticatedAt: string;
  expiresAt: string;
  /** Explicit: presence carries no World grant. */
  worldGrant: null;
  membership: null;
}>;

export type WorldEntryAttempt = Readonly<{
  worldId: UUID;
  purpose: string;
}>;

const SECRET_MIN = 32;

export function createDoor(pool: Pool, baseURL: string, secret: string) {
  if (typeof baseURL !== 'string' || baseURL.length < 8) throw new Error('DOOR_BASE_URL');
  if (typeof secret !== 'string' || secret.length < SECRET_MIN) throw new Error('DOOR_SECRET');
  return betterAuth({
    database: pool,
    baseURL,
    secret,
    trustedOrigins: [baseURL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: true,
    },
    // Password account control ≠ email ownership. No invitations or grants here.
    session: { cookieCache: { enabled: false }, expiresIn: 60 * 60 * 8, updateAge: 60 * 30 },
    advanced: {
      database: { generateId: () => randomUUID() },
      cookiePrefix: 'zoen',
      useSecureCookies: baseURL.startsWith('https:'),
    },
    rateLimit: { enabled: true, window: 60, max: 40 },
  });
}

export type Door = ReturnType<typeof createDoor>;

export type DoorPort = Readonly<{
  verify(assertion: PresenceAssertion): Promise<Result<PresenceProof>>;
  present(headers: Headers): Promise<Result<VerifiedContext>>;
  /** Presence-only: never issues a World grant. */
  attemptPrivateWorldEntry(
    assertion: PresenceAssertion,
    attempt: WorldEntryAttempt,
  ): Promise<Result<never>>;
  revokeSession(assertion: PresenceAssertion, sessionToken: string): Promise<Result<{ revoked: true }>>;
  mapSubject(subjectId: string): Promise<Result<UUID>>;
}>;

async function ensureSubjectMap(pool: Pool, subjectId: string): Promise<UUID> {
  const existing = await pool.query<{ principal_id: string }>(
    'SELECT principal_id::text AS principal_id FROM door.subject_map WHERE subject_id = $1',
    [subjectId],
  );
  if (existing.rows[0]) return uuid(existing.rows[0].principal_id);
  const principalId = randomUUID();
  // Map stable Better Auth user id → principal. Never email/name.
  await pool.query(
    `INSERT INTO door.subject_map(subject_id, principal_id, provider)
     VALUES ($1, $2::uuid, 'better-auth')
     ON CONFLICT (subject_id) DO NOTHING`,
    [subjectId, principalId],
  );
  const again = await pool.query<{ principal_id: string }>(
    'SELECT principal_id::text AS principal_id FROM door.subject_map WHERE subject_id = $1',
    [subjectId],
  );
  if (!again.rows[0]) throw new Error('SUBJECT_MAP_FAILED');
  return uuid(again.rows[0].principal_id);
}

function cookieFromHeaders(headers: Headers): string | null {
  const cookie = headers.get('cookie');
  return cookie && cookie.length > 0 ? cookie : null;
}

export function createDoorPort(door: Door, pool: Pool, audience: string): DoorPort {
  if (typeof audience !== 'string' || audience.length < 8) throw new Error('DOOR_AUDIENCE');

  async function verify(assertion: PresenceAssertion): Promise<Result<PresenceProof>> {
    if (assertion.audience !== audience) return fail('Denied', 'WRONG_AUDIENCE');
    if (!cookieFromHeaders(assertion.headers)) return fail('Denied', 'AUTHENTICATION_REQUIRED');

    let session: Awaited<ReturnType<Door['api']['getSession']>>;
    try {
      session = await door.api.getSession({ headers: assertion.headers });
    } catch {
      return fail('Unavailable', 'SESSION_LOOKUP_FAILED');
    }
    if (!session) return fail('Denied', 'AUTHENTICATION_REQUIRED');

    const expiresAt = new Date(session.session.expiresAt);
    if (!(expiresAt.getTime() > Date.now())) return fail('Expired', 'SESSION_EXPIRED');

    const subjectId = String(session.user.id);
    // Reject using email/name as identity key — only opaque subject id maps.
    if (!subjectId || subjectId.includes('@')) return fail('InvalidInput', 'SUBJECT_NOT_OPAQUE');

    let principalId: UUID;
    try {
      principalId = await ensureSubjectMap(pool, subjectId);
    } catch {
      return fail('Unavailable', 'SUBJECT_MAP_FAILED');
    }

    return ok(
      Object.freeze({
        tag: 'PresenceProof' as const,
        subjectId,
        principalId,
        sessionId: String(session.session.id),
        sessionToken: String(session.session.token),
        audience,
        authenticatedAt: new Date(session.session.createdAt).toISOString(),
        expiresAt: expiresAt.toISOString(),
        worldGrant: null,
        membership: null,
      }),
    );
  }

  return Object.freeze({
    verify,

    async present(headers: Headers): Promise<Result<VerifiedContext>> {
      const proof = await verify({ headers, audience });
      if (proof.tag !== 'Ok') return proof;
      return ok(
        Object.freeze({
          principalId: proof.value.principalId,
          actorId: proof.value.principalId,
          sessionId: proof.value.sessionId,
          authenticatedAt: proof.value.authenticatedAt,
          assurance: 'authenticated' as const,
          appSessionId: null,
          transport: 'web' as const,
        }),
      );
    },

    async attemptPrivateWorldEntry(
      assertion: PresenceAssertion,
      attempt: WorldEntryAttempt,
    ): Promise<Result<never>> {
      const proof = await verify(assertion);
      if (proof.tag !== 'Ok') return proof;
      // INV-01: Door proves presence only. No grant from presence alone.
      void attempt;
      void proof.value.principalId;
      return fail('Denied', 'PRESENCE_NOT_A_GRANT');
    },

    async revokeSession(
      assertion: PresenceAssertion,
      sessionToken: string,
    ): Promise<Result<{ revoked: true }>> {
      if (assertion.audience !== audience) return fail('Denied', 'WRONG_AUDIENCE');
      if (typeof sessionToken !== 'string' || sessionToken.length < 8) {
        return fail('InvalidInput', 'SESSION_TOKEN');
      }
      try {
        await door.api.revokeSession({
          headers: assertion.headers,
          body: { token: sessionToken },
        });
      } catch {
        return fail('Denied', 'SESSION_REVOKE_DENIED');
      }
      await pool.query(
        `INSERT INTO door.revoked_sessions(session_token, principal_id, reason)
         SELECT $1, principal_id, 'explicit'
         FROM door.subject_map
         WHERE subject_id = (
           SELECT "userId" FROM session WHERE token = $1 LIMIT 1
         )
         ON CONFLICT (session_token) DO NOTHING`,
        [sessionToken],
      ).catch(() => {
        /* best-effort ledger; BA revoke is authoritative for session row */
      });
      return ok(Object.freeze({ revoked: true as const }));
    },

    async mapSubject(subjectId: string): Promise<Result<UUID>> {
      if (typeof subjectId !== 'string' || subjectId.length < 8 || subjectId.includes('@')) {
        return fail('InvalidInput', 'SUBJECT_NOT_OPAQUE');
      }
      try {
        return ok(await ensureSubjectMap(pool, subjectId));
      } catch {
        return fail('Unavailable', 'SUBJECT_MAP_FAILED');
      }
    },
  });
}

/** Test/helper: sign up and return signed cookie pair for presence assertions. */
export async function signUpWithCookie(
  door: Door,
  input: { email: string; password: string; name: string },
): Promise<Result<{ cookie: string; subjectId: string; token: string }>> {
  try {
    const { headers, response } = await door.api.signUpEmail({
      body: input,
      returnHeaders: true,
    });
    const setCookie = headers.get('set-cookie');
    if (!setCookie) return fail('Unavailable', 'SIGNUP_NO_COOKIE');
    const cookie = setCookie.split(';')[0]!;
    return ok(
      Object.freeze({
        cookie,
        subjectId: String(response.user.id),
        token: String(response.token),
      }),
    );
  } catch {
    return fail('InvalidInput', 'SIGNUP_FAILED');
  }
}
