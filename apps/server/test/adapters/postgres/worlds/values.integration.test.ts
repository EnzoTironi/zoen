import { expect, it } from "@effect/vitest";
import { DecimalText, LocalDate } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withWorldsDatabase } from "./database.ts";
import { claimRow, seedEvidence } from "./seed.ts";

it.live(
  "Worlds PostgreSQL preserves decimal precision, Known zero, Unknown and civil dates in different timezones",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* values() {
        const sql = yield* SqlClient.SqlClient;
        const seed = yield* seedEvidence();
        for (const amount of [
          "0",
          "99999999999999999999.123456789012345678",
          "-0.000000000000000001",
        ]) {
          const row = {
            ...claimRow(seed),
            amount,
            valid_from: "0001-01-01",
            valid_to: "9999-12-31",
          };
          yield* sql`INSERT INTO authority.claims ${sql.insert(row)}`;
          for (const timezone of ["Pacific/Kiritimati", "America/Sao_Paulo"]) {
            yield* sql.withTransaction(
              Effect.gen(function* civilDate() {
                yield* sql`SELECT set_config('TimeZone', ${timezone}, true), set_config('DateStyle', 'SQL, DMY', true)`;
                const result =
                  yield* sql`SELECT amount::text AS amount, to_char(valid_from, 'YYYY-MM-DD') AS from, to_char(valid_to, 'YYYY-MM-DD') AS to FROM authority.claims WHERE claim_id = ${row.claim_id}`.pipe(
                    Effect.flatMap(
                      Schema.decodeUnknownEffect(
                        Schema.Tuple([
                          Schema.Struct({
                            amount: DecimalText,
                            from: LocalDate,
                            to: LocalDate,
                          }),
                        ])
                      )
                    )
                  );
                expect(result).toStrictEqual([
                  {
                    amount: amount === "0" ? "0.000000000000000000" : amount,
                    from: "0001-01-01",
                    to: "9999-12-31",
                  },
                ]);
              })
            );
          }
        }
        const unknown = {
          ...claimRow(seed),
          amount: null,
          currency: null,
          valid_from: null,
          valid_to: null,
          value_tag: "Unknown",
        };
        yield* sql`INSERT INTO authority.claims ${sql.insert(unknown)}`;
        expect(
          yield* sql`SELECT value_tag, amount, currency, valid_from, valid_to FROM authority.claims WHERE claim_id = ${unknown.claim_id}`
        ).toStrictEqual([
          {
            amount: null,
            currency: null,
            valid_from: null,
            valid_to: null,
            value_tag: "Unknown",
          },
        ]);
        for (const invalid of [
          { ...claimRow(seed), amount: null },
          { ...claimRow(seed), value_tag: "Unknown" },
          { ...claimRow(seed), amount: "NaN" },
          { ...claimRow(seed), currency: "JPY" },
          { ...claimRow(seed), valid_to: null },
          { ...claimRow(seed), valid_to: "2026-01-01" },
          { ...claimRow(seed), valid_from: "0001-01-01 BC" },
          { ...claimRow(seed), valid_to: "10000-01-01" },
        ]) {
          expect(
            yield* sql`INSERT INTO authority.claims ${sql.insert(invalid)}`.pipe(
              Effect.flip
            )
          ).toMatchObject({
            _tag: "SqlError",
            reason: { _tag: "ConstraintError" },
          });
        }
        expect(
          yield* sql`SELECT COUNT(*)::text AS count FROM authority.claims`
        ).toStrictEqual([{ count: "4" }]);
      }).pipe(Effect.provide(database.authority))
    )
);
