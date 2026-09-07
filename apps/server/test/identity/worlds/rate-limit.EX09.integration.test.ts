import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01IdentityDatabase } from "./database.ts";
import { createAccount, postAuth } from "./http.ts";

it.live(
  "EX09 real provider persists and enforces its login attempt limit",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* rateLimit() {
        const account = yield* createAccount(fixture.config.baseUrl);
        const statuses = [];
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const response = yield* postAuth(
            fixture.config.baseUrl,
            "sign-in/email",
            {
              email: account.email,
              password: "invalid-password-for-rate-limit",
            }
          );
          statuses.push(response.status);
        }
        const persisted = yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`SELECT count(*)::integer AS count FROM identity."rateLimit"`
        ).pipe(Effect.provide(fixture.database.identity));
        expect(statuses).toStrictEqual([401, 401, 401, 429]);
        expect(persisted).toStrictEqual([{ count: 2 }]);
      }).pipe(Effect.provide(fixture.runtime))
    )
);
