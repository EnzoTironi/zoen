import type { BetterAuthOptions } from "better-auth";
import { Effect, Redacted, Schema } from "effect";
import type { Pool } from "pg";

export const IdentityConfig = Schema.Struct({
  baseUrl: Schema.URLFromString.check(
    Schema.makeFilter(
      (url) =>
        url.pathname === "/" &&
        url.search === "" &&
        url.hash === "" &&
        url.username === "" &&
        url.password === "" &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" &&
            ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    )
  ),
  databaseUrl: Schema.Redacted(Schema.NonEmptyString),
  secret: Schema.Redacted(
    Schema.String.check(Schema.isMinLength(32), Schema.isMaxLength(1024))
  ),
  sessionSeconds: Schema.Int.check(
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(604_800)
  ),
});
export type IdentityConfig = typeof IdentityConfig.Encoded;

export class IdentityConfigurationError extends Schema.TaggedError<IdentityConfigurationError>()(
  "IdentityConfigurationError",
  { code: Schema.Literal("invalid_identity_configuration") }
) {}

/** No library log arguments are forwarded: they can contain SQL and request data. */
const authLog = (level: "debug" | "info" | "warn" | "error") => {
  Effect.runSync(
    Effect.logWithLevel(level === "error" ? "Error" : "Warn")(
      "Identity provider event"
    )
  );
};

/** The same options drive the real provider and its generated migration. */
export const identityAuthOptions = (
  config: typeof IdentityConfig.Type,
  pool: Pool
) =>
  ({
    advanced: {
      cookiePrefix: "zoen-worlds",
      database: { generateId: "uuid" },
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
      disableCSRFCheck: false,
      disableOriginCheck: false,
      ipAddress: { ipAddressHeaders: [] },
      trustedProxyHeaders: false,
      useSecureCookies: config.baseUrl.protocol === "https:",
    },
    appName: "Zoen",
    basePath: "/api/auth",
    baseURL: config.baseUrl.origin,
    database: pool,
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      requireEmailVerification: false,
    },
    logger: { level: "warn", log: authLog },
    rateLimit: { enabled: true, storage: "database" },
    secret: Redacted.value(config.secret),
    session: {
      cookieCache: { enabled: false },
      disableSessionRefresh: true,
      expiresIn: config.sessionSeconds,
    },
    telemetry: { enabled: false },
    trustedOrigins: [config.baseUrl.origin],
  }) satisfies BetterAuthOptions;
