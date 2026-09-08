/* oxlint-disable unicorn/consistent-function-scoping, eslint/prefer-destructuring, typescript/no-unsafe-type-assertion */
import { randomBytes, randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  EvidenceImported,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { SemanticExecutor } from "@zoen/ontology/semantic/executor";
import { canonicalJson } from "@zoen/ontology/values/canonical";
import { Effect, Layer, Schema } from "effect";
import type { Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { applyIdentityBasisMigrations } from "../../../../ops/migrations/run.ts";
import {
  http,
  jsonBody,
  responseCookie,
  withLegacyBasisHarness,
  asCurrentCredential,
  asCurrentWire,
  legacyWire,
} from "./harness.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const { envelope, executePath } = legacyWire;
const validTime = {
  _tag: "DateInterval" as const,
  from: "2026-09-01",
  to: "2026-10-01",
};

interface WorldFixture {
  readonly frameRef: string;
  readonly owner: Redacted.Redacted;
  readonly subject: string;
  readonly worldRef: {
    readonly realm: string;
    readonly worldId: string;
  };
}

const jsonDocument = (revision: string, amount: string, subject: string) =>
  json({
    records: [
      {
        externalId: subject,
        predicate: "obligation.amount",
        subjectKey: subject,
        validTime,
        value: { _tag: "Known", amount, currency: "BRL" },
      },
    ],
    schemaVersion: "d01.v1",
    source: {
      externalId: `billing-${subject}`,
      label: "JSON source",
      namespace: "independent-review",
      revision,
    },
  });

it.live(
  "independent: multi-world legacy bases survive 007; corrupt digest is Unavailable not Stale",
  () =>
    withLegacyBasisHarness((harness) =>
      Effect.gen(function* refuteLegacyPromotion() {
        const worlds: WorldFixture[] = [];
        for (const subject of ["invoice-a", "invoice-b"] as const) {
          const signup = yield* http(
            harness.origin,
            "/api/auth/sign-up/email",
            json({
              email: `${randomUUID()}@example.test`,
              name: `Owner ${subject}`,
              password: randomBytes(24).toString("base64url"),
            })
          );
          expect(signup.status).toBe(200);
          const owner = responseCookie(signup);
          const createdResponse = yield* http(
            harness.origin,
            executePath,
            json({
              ...envelope,
              input: {},
              operation: "CreatePersonalWorld",
              operationId: randomUUID(),
            }),
            owner
          );
          expect(createdResponse.status).toBe(200);
          const { worldRef } = yield* jsonBody(createdResponse).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
          );
          const imported = yield* http(
            harness.origin,
            executePath,
            json({
              ...envelope,
              input: { document: jsonDocument("1", "100.00", subject) },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            }),
            owner
          );
          expect(imported.status).toBe(200);
          yield* jsonBody(imported).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(EvidenceImported))
          );
          const inspectedResponse = yield* http(
            harness.origin,
            executePath,
            json({
              ...envelope,
              input: { atFrame: null, subjectKey: subject },
              operation: "Inspect",
              worldRef,
            }),
            owner
          );
          expect(inspectedResponse.status).toBe(200);
          const inspected = yield* jsonBody(inspectedResponse).pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
          );
          worlds.push({
            frameRef: inspected.frame.frameRef,
            owner,
            subject,
            worldRef,
          });
        }

        const sql = yield* SqlClient.SqlClient;
        const beforeDomains = yield* sql`
          SELECT world_id::text AS world_id, domain_key, version::text AS version
          FROM authority.domains
          ORDER BY world_id, domain_key`;
        expect(
          beforeDomains.every((row) => row.domain_key !== "identity")
        ).toBeTruthy();
        expect(beforeDomains).toHaveLength(10);
        const beforeFrames = yield* sql`
          SELECT frame_id::text AS frame_id, world_id::text AS world_id,
                 internal_basis, visible_frame
          FROM authority.frames
          ORDER BY created_at`;
        const frameSnapshots = [];
        for (const frame of beforeFrames) {
          const basis = frame.internal_basis as {
            cut: Record<string, unknown>;
          };
          expect(frame.internal_basis).not.toHaveProperty("schemaVersion");
          expect(basis.cut).not.toHaveProperty("identity");
          frameSnapshots.push({
            basis: yield* canonicalJson(frame.internal_basis),
            frameId: frame.frame_id,
            visible: yield* canonicalJson(frame.visible_frame),
            worldId: frame.world_id,
          });
        }
        const beforeReceipts = yield* sql`
          SELECT receipt_id::text AS receipt_id, result
          FROM authority.receipts
          ORDER BY committed_at`;
        const receiptSnapshots = [];
        for (const receipt of beforeReceipts) {
          receiptSnapshots.push({
            receiptId: receipt.receipt_id,
            result: yield* canonicalJson(receipt.result),
          });
        }

        const { runtime } = yield* harness.transitionToCurrentComponent();
        for (const world of worlds) {
          Object.assign(world, { owner: asCurrentCredential(world.owner) });
        }

        const afterDomains = yield* sql`
          SELECT world_id::text AS world_id, domain_key, version::text AS version
          FROM authority.domains
          ORDER BY world_id, domain_key`;
        expect(afterDomains).toHaveLength(12);
        for (const world of worlds) {
          const identity = afterDomains.find(
            (row) =>
              row.world_id === world.worldRef.worldId &&
              row.domain_key === "identity"
          );
          expect(identity?.version).toBe("0");
        }
        for (const prior of beforeDomains) {
          const still = afterDomains.find(
            (row) =>
              row.world_id === prior.world_id &&
              row.domain_key === prior.domain_key
          );
          expect(still?.version).toBe(prior.version);
        }
        const afterFrames = yield* sql`
          SELECT frame_id::text AS frame_id, world_id::text AS world_id,
                 internal_basis, visible_frame
          FROM authority.frames
          ORDER BY created_at`;
        expect(afterFrames).toHaveLength(frameSnapshots.length);
        for (let index = 0; index < afterFrames.length; index += 1) {
          const after = afterFrames[index];
          const snap = frameSnapshots[index];
          if (after === undefined || snap === undefined) {
            return yield* Effect.die("Frame snapshot mismatch");
          }
          expect(yield* canonicalJson(after.internal_basis)).toBe(snap.basis);
          expect(yield* canonicalJson(after.visible_frame)).toBe(snap.visible);
        }
        const afterReceipts = yield* sql`
          SELECT receipt_id::text AS receipt_id, result
          FROM authority.receipts
          ORDER BY committed_at`;
        expect(afterReceipts).toHaveLength(receiptSnapshots.length);
        for (let index = 0; index < afterReceipts.length; index += 1) {
          const after = afterReceipts[index];
          const snap = receiptSnapshots[index];
          if (after === undefined || snap === undefined) {
            return yield* Effect.die("Receipt snapshot mismatch");
          }
          expect(yield* canonicalJson(after.result)).toBe(snap.result);
        }

        const domainsBeforeReapply = afterDomains;
        yield* applyIdentityBasisMigrations(harness.database.names).pipe(
          Effect.provide(
            Layer.mergeAll(harness.database.migration, NodeServices.layer)
          )
        );
        expect(
          yield* sql`
            SELECT world_id::text AS world_id, domain_key, version::text AS version
            FROM authority.domains
            ORDER BY world_id, domain_key`
        ).toStrictEqual(domainsBeforeReapply);

        const corruptFrame = (
          worldId: string,
          frameId: string,
          basis: unknown
        ) =>
          Effect.gen(function* writeCorrupt() {
            const migrationSql = yield* SqlClient.SqlClient;
            const encoded = JSON.stringify(basis);
            yield* migrationSql`UPDATE authority.frames
              SET internal_basis = ${encoded}::jsonb
              WHERE world_id = ${worldId}::uuid
                AND frame_id = ${frameId}::uuid`;
          }).pipe(Effect.provide(harness.database.migration));

        return yield* Effect.gen(function* withCurrentExecutor() {
          const executor = yield* SemanticExecutor;
          const bytes = (value: unknown) =>
            canonicalJson(value).pipe(
              Effect.map((text) => new TextEncoder().encode(text))
            );
          const primary = worlds[0];
          const secondary = worlds[1];
          if (primary === undefined || secondary === undefined) {
            return yield* Effect.die("Expected two legacy worlds");
          }

          const historical = yield* executor
            .execute(
              primary.owner,
              yield* bytes(
                asCurrentWire({
                  ...envelope,
                  input: {
                    atFrame: primary.frameRef,
                    subjectKey: primary.subject,
                  },
                  operation: "Inspect",
                  worldRef: primary.worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          const selected = historical.frame.claims[0];
          if (selected === undefined) {
            return yield* Effect.die("Expected historical claim");
          }
          expect(
            yield* executor
              .executeCorrection(
                primary.owner,
                yield* bytes(
                  asCurrentWire({
                    ...envelope,
                    input: {
                      consequence: {
                        choice: {
                          _tag: "selectClaim",
                          claimRef: selected.claimRef,
                        },
                        subjectKey: primary.subject,
                        validTime,
                      },
                      frameRef: primary.frameRef,
                    },
                    operation: "ProposeCorrection",
                    operationId: randomUUID(),
                    worldRef: primary.worldRef,
                  })
                )
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });

          const targets = yield* sql`
            SELECT frame_id::text AS frame_id, internal_basis
            FROM authority.frames
            WHERE world_id = ${secondary.worldRef.worldId}::uuid
              AND frame_id = ${secondary.frameRef}::uuid`;
          const target = targets[0];
          if (target === undefined) {
            return yield* Effect.die("Expected secondary frame row");
          }
          const targetBasis = target.internal_basis as Record<string, unknown>;
          yield* corruptFrame(secondary.worldRef.worldId, secondary.frameRef, {
            ...targetBasis,
            readSetDigest: "a".repeat(64),
          });
          const corruptedInspect = yield* executor
            .execute(
              secondary.owner,
              yield* bytes(
                asCurrentWire({
                  ...envelope,
                  input: {
                    atFrame: secondary.frameRef,
                    subjectKey: secondary.subject,
                  },
                  operation: "Inspect",
                  worldRef: secondary.worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          const claim = corruptedInspect.frame.claims[0];
          if (claim === undefined) {
            return yield* Effect.die("Expected corrupted-frame claim");
          }
          expect(
            yield* executor
              .executeCorrection(
                secondary.owner,
                yield* bytes(
                  asCurrentWire({
                    ...envelope,
                    input: {
                      consequence: {
                        choice: {
                          _tag: "selectClaim",
                          claimRef: claim.claimRef,
                        },
                        subjectKey: secondary.subject,
                        validTime,
                      },
                      frameRef: secondary.frameRef,
                    },
                    operation: "ProposeCorrection",
                    operationId: randomUUID(),
                    worldRef: secondary.worldRef,
                  })
                )
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Unavailable" });

          const live = yield* executor
            .execute(
              primary.owner,
              yield* bytes(
                asCurrentWire({
                  ...envelope,
                  input: { atFrame: null, subjectKey: primary.subject },
                  operation: "Inspect",
                  worldRef: primary.worldRef,
                })
              )
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected)));
          const liveRows = yield* sql`
            SELECT internal_basis
            FROM authority.frames
            WHERE world_id = ${primary.worldRef.worldId}::uuid
              AND frame_id = ${live.frame.frameRef}::uuid`;
          const liveRow = liveRows[0];
          if (liveRow === undefined) {
            return yield* Effect.die("Expected live frame row");
          }
          expect(liveRow.internal_basis).toMatchObject({
            schemaVersion: "authority.basis.v2",
          });
          const liveBasis = liveRow.internal_basis as Record<string, unknown>;
          yield* corruptFrame(primary.worldRef.worldId, live.frame.frameRef, {
            ...liveBasis,
            readSetDigest: "b".repeat(64),
          });
          const liveClaim = live.frame.claims[0];
          if (liveClaim === undefined) {
            return yield* Effect.die("Expected live claim");
          }
          expect(
            yield* executor
              .executeCorrection(
                primary.owner,
                yield* bytes(
                  asCurrentWire({
                    ...envelope,
                    input: {
                      consequence: {
                        choice: {
                          _tag: "selectClaim",
                          claimRef: liveClaim.claimRef,
                        },
                        subjectKey: primary.subject,
                        validTime,
                      },
                      frameRef: live.frame.frameRef,
                    },
                    operation: "ProposeCorrection",
                    operationId: randomUUID(),
                    worldRef: primary.worldRef,
                  })
                )
              )
              .pipe(Effect.flip)
          ).toMatchObject({ _tag: "Stale" });

          return {
            frames: frameSnapshots.length,
            oracles: [
              "multi-world-007",
              "idempotent-migrator",
              "legacy-corrupt-Unavailable",
              "current-digest-Stale",
            ],
            revision: harness.legacy.revision,
            worlds: worlds.length,
          };
        }).pipe(Effect.provide(runtime));
      }).pipe(Effect.provide(harness.database.authority))
    ),
  240_000
);
