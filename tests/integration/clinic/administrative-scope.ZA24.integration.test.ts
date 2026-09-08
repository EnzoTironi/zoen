import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  DateTime,
  Deferred,
  Effect,
  Fiber,
  FileSystem,
  Layer,
  Option,
  Schema,
} from "effect";
import type { Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withStorage } from "../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withIdentityDatabase } from "../../../apps/server/test/identity/database.js";
import { createAccount } from "../../../apps/server/test/identity/http.js";
import {
  GrantWorldReadAccess,
  RevokeWorldReadAccess,
} from "../../../packages/contracts/src/sharing/operations.js";
import { ImportDocument } from "../../../packages/contracts/src/worlds/evidence.js";
import {
  CreatePersonalWorld,
  ImportEvidence,
  Inspect,
  OpenEvidence,
  ProposeCorrection,
  AnswerQuestion,
} from "../../../packages/contracts/src/worlds/operations.js";
import type { WorldRef } from "../../../packages/contracts/src/worlds/values.js";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../../../packages/ontology/src/access/sharing/mutation.js";
import { createPersonalWorld } from "../../../packages/ontology/src/commit/genesis.js";
import { importEvidence } from "../../../packages/ontology/src/evidence/import.js";
import { openEvidence } from "../../../packages/ontology/src/evidence/open.js";
import { answerQuestion } from "../../../packages/ontology/src/knowledge/corrections/answer.js";
import { proposeCorrection } from "../../../packages/ontology/src/knowledge/corrections/propose.js";
import { inspect } from "../../../packages/ontology/src/knowledge/inspect.js";
import {
  Presence,
  VerifiedRequestContext,
} from "../../../packages/ontology/src/ports/worlds/context.js";
import { EvidenceObjectStore } from "../../../packages/ontology/src/ports/worlds/storage.js";
import { canonicalJson } from "../../../packages/ontology/src/values/canonical.js";
import { configuration } from "../worlds/commit/fixture.js";

type Fixture = Parameters<Parameters<typeof withIdentityDatabase>[0]>[0];

const installSharing = (fixture: Fixture) =>
  Effect.gen(function* installSharingSchema() {
    const source = yield* FileSystem.FileSystem.use((fs) =>
      fs.readFileString(
        fileURLToPath(
          new URL(
            "../../../ops/migrations/005_world_read_membership.sql",
            import.meta.url
          )
        )
      )
    );
    yield* SqlClient.SqlClient.use((sql) =>
      sql.withTransaction(sql.unsafe(source))
    );
  }).pipe(
    Effect.provide(
      Layer.mergeAll(NodeFileSystem.layer, fixture.database.migration)
    )
  );

const contextFromCredential = Effect.fn("ZA24.contextFromCredential")(
  function* contextFromCredential(credential: Redacted.Redacted) {
    const presence = yield* Presence;
    const verified = yield* presence.verify(credential);
    const now = yield* DateTime.now;
    return yield* Schema.decodeEffect(VerifiedRequestContext)({
      deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
      presence: verified,
      purpose: "personal-records",
    });
  }
);

const worldsEnvelope = {
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
} as const;
const sharingEnvelope = {
  purpose: "personal-records",
  schemaVersion: "sharing.v1",
} as const;

const createRequest = () =>
  Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    ...worldsEnvelope,
  });

const fee = (
  externalId: string,
  subjectKey: string,
  amount: string,
  from: string,
  to: string,
  currency: "BRL" | "USD" | "EUR" = "BRL"
) => ({
  externalId,
  predicate: "obligation.amount" as const,
  subjectKey,
  validTime: { _tag: "DateInterval" as const, from, to },
  value: { _tag: "Known" as const, amount, currency },
});

const importDocument = (worldRef: WorldRef, document: string) =>
  Schema.decodeEffect(ImportEvidence)({
    ...worldsEnvelope,
    input: { document },
    operation: "ImportEvidence",
    operationId: randomUUID(),
    worldRef,
  });

const inspectSubject = (worldRef: WorldRef, subjectKey: string) =>
  Schema.decodeEffect(Inspect)({
    ...worldsEnvelope,
    input: { atFrame: null, subjectKey },
    operation: "Inspect",
    worldRef,
  });

it.live(
  "ZA-24 clinic admin: contested fees, clinical exclusion before retrieval, mid-fetch revoke",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* setupClinic() {
        yield* installSharing(fixture);
        return yield* withStorage(() =>
          Effect.scoped(
            Effect.gen(function* clinicJourney() {
              const owner = yield* createAccount(fixture.config.baseUrl);
              const viewer = yield* createAccount(fixture.config.baseUrl);
              const ownerContext = yield* contextFromCredential(
                owner.credential
              );
              const viewerContext = yield* contextFromCredential(
                viewer.credential
              );
              const { worldRef } = yield* createPersonalWorld(
                ownerContext,
                yield* createRequest()
              );

              const agenda = yield* canonicalJson({
                records: [
                  fee(
                    "consulta-ortodontia-2026-09-22",
                    "compromisso-consulta-ortodontia-2026-09-22",
                    "280.00",
                    "2026-09-22",
                    "2026-09-23"
                  ),
                  fee(
                    "retorno-avaliacao-2026-09-24",
                    "compromisso-retorno-avaliacao-2026-09-24",
                    "120.00",
                    "2026-09-24",
                    "2026-09-25"
                  ),
                ],
                schemaVersion: "worlds.v1",
                source: {
                  externalId: "agenda-administrativa-2026-09-22",
                  label: "Agenda administrativa — 22/09",
                  namespace: "clinic.appointments",
                  revision: "1",
                },
              });
              const fees = yield* canonicalJson({
                records: [
                  fee(
                    "consulta-ortodontia-2026-09-22",
                    "compromisso-consulta-ortodontia-2026-09-22",
                    "350.00",
                    "2026-09-22",
                    "2026-09-23"
                  ),
                  fee(
                    "limpeza-preventiva-2026-09-25",
                    "compromisso-limpeza-preventiva-2026-09-25",
                    "200.00",
                    "2026-09-25",
                    "2026-09-26"
                  ),
                ],
                schemaVersion: "worlds.v1",
                source: {
                  externalId: "tabela-honorarios-2026-09-22",
                  label: "Tabela de honorários — 22/09",
                  namespace: "clinic.fees",
                  revision: "1",
                },
              });
              const importedAgenda = yield* importEvidence(
                ownerContext,
                yield* importDocument(worldRef, agenda)
              );
              yield* importEvidence(
                ownerContext,
                yield* importDocument(worldRef, fees)
              );

              const consultaKey = "compromisso-consulta-ortodontia-2026-09-22";
              const consulta = yield* inspect(
                ownerContext,
                yield* inspectSubject(worldRef, consultaKey)
              );
              expect(consulta.frame.subjectKey).toBe(consultaKey);
              expect(consulta.frame.contested).toBeTruthy();
              expect(consulta.frame.selection).toStrictEqual({
                _tag: "unresolved",
              });
              expect(consulta.frame.verification).toBe("unverified");
              expect(
                consulta.frame.claims
                  .map((claim) => claim.source.label)
                  .toSorted()
              ).toStrictEqual([
                "Agenda administrativa — 22/09",
                "Tabela de honorários — 22/09",
              ]);
              expect(
                consulta.frame.claims
                  .map((claim) =>
                    claim.value._tag === "Known"
                      ? `${claim.value.amount} ${claim.value.currency}`
                      : "Unknown"
                  )
                  .toSorted()
              ).toStrictEqual(["280 BRL", "350 BRL"]);

              // Only permitted administrative namespaces appear — no clinical metadata.
              expect(
                consulta.frame.claims
                  .map((claim) => claim.source.namespace)
                  .toSorted()
              ).toStrictEqual(["clinic.appointments", "clinic.fees"]);
              for (const claim of consulta.frame.claims) {
                expect(claim.predicate).toBe("obligation.amount");
                expect(
                  claim.source.namespace.startsWith("clinic.clinical")
                ).toBeFalsy();
                expect(claim.source.label.toLowerCase()).not.toMatch(
                  /diagnos|prontu[aá]rio|treatment/u
                );
              }

              const retorno = yield* inspect(
                ownerContext,
                yield* inspectSubject(
                  worldRef,
                  "compromisso-retorno-avaliacao-2026-09-24"
                )
              );
              expect(retorno.frame.contested).toBeFalsy();
              expect(retorno.frame.claims).toHaveLength(1);
              expect(retorno.frame.selection._tag).toBe("selected");

              // ZA-24-02 — clinical predicates fail closed before capture/retrieval.
              expect(
                Option.isNone(
                  Schema.decodeUnknownOption(ImportDocument)({
                    records: [
                      {
                        externalId: "chart-row",
                        predicate: "diagnosis.code",
                        subjectKey: "paciente-excluido",
                        validTime: {
                          _tag: "DateInterval",
                          from: "2026-09-22",
                          to: "2026-09-23",
                        },
                        value: {
                          _tag: "Known",
                          amount: "1.00",
                          currency: "BRL",
                        },
                      },
                    ],
                    schemaVersion: "worlds.v1",
                    source: {
                      externalId: "clinical-corpus",
                      label: "Prontuário clínico (excluído)",
                      namespace: "clinic.clinical",
                      revision: "1",
                    },
                  })
                )
              ).toBeTruthy();

              // Clinical document text that cannot decode — import fails before staging.
              const clinicalBlob =
                '{"schemaVersion":"worlds.v1","source":{"namespace":"clinic.clinical","externalId":"clinical-corpus","label":"Prontuario clinico (excluido)","revision":"1"},"records":[{"externalId":"chart-row","predicate":"treatment.plan","subjectKey":"paciente-excluido","validTime":{"_tag":"DateInterval","from":"2026-09-22","to":"2026-09-23"},"value":{"_tag":"Known","amount":"1.00","currency":"BRL"}}]}';
              expect(
                yield* importEvidence(
                  ownerContext,
                  yield* importDocument(worldRef, clinicalBlob)
                ).pipe(Effect.flip)
              ).toMatchObject({
                _tag: "InvalidInput",
                code: "INVALID_INPUT",
              });

              // Excluded/unknown clinical evidence ref — deny without existence leak.
              const phantomClinical = randomUUID();
              const deniedOpen = yield* openEvidence(
                ownerContext,
                yield* Schema.decodeEffect(OpenEvidence)({
                  ...worldsEnvelope,
                  input: { evidenceRef: phantomClinical },
                  operation: "OpenEvidence",
                  worldRef,
                })
              ).pipe(Effect.flip);
              expect(Object.keys(deniedOpen).toSorted()).toStrictEqual([
                "_tag",
                "code",
              ]);
              expect(deniedOpen).toMatchObject({
                _tag: "NotFoundOrDenied",
                code: "NOT_FOUND_OR_DENIED",
              });

              // ZA-24-01 — authorized scoped correction through the executor.
              const agendaClaim = consulta.frame.claims.find(
                (claim) => claim.source.namespace === "clinic.appointments"
              );
              if (agendaClaim === undefined) {
                throw new Error("Agenda claim required for correction");
              }
              const proposed = yield* proposeCorrection(
                ownerContext,
                yield* Schema.decodeEffect(ProposeCorrection)({
                  ...worldsEnvelope,
                  input: {
                    consequence: {
                      choice: {
                        _tag: "selectClaim",
                        claimRef: agendaClaim.claimRef,
                      },
                      subjectKey: consultaKey,
                      validTime: {
                        _tag: "DateInterval",
                        from: "2026-09-22",
                        to: "2026-09-23",
                      },
                    },
                    frameRef: consulta.frame.frameRef,
                  },
                  operation: "ProposeCorrection",
                  operationId: randomUUID(),
                  worldRef,
                })
              );
              yield* answerQuestion(
                ownerContext,
                yield* Schema.decodeEffect(AnswerQuestion)({
                  ...worldsEnvelope,
                  input: {
                    answer: "confirm",
                    consequenceDigest: proposed.consequenceDigest,
                    questionRef: proposed.questionRef,
                  },
                  operation: "AnswerQuestion",
                  operationId: randomUUID(),
                  worldRef,
                })
              );
              const corrected = yield* inspect(
                ownerContext,
                yield* inspectSubject(worldRef, consultaKey)
              );
              expect(corrected.frame.scopedCorrections).toHaveLength(1);
              expect(corrected.frame.claims.length).toBeGreaterThanOrEqual(2);

              // ZA-24-03 — grant viewer, revoke mid OpenEvidence fetch; admin intact.
              const grant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
                ...sharingEnvelope,
                input: {
                  expectedRevision: null,
                  principalRef: viewer.user.id,
                },
                operation: "GrantWorldReadAccess",
                operationId: randomUUID(),
                worldRef,
              });
              const granted = yield* grantWorldReadAccess(ownerContext, grant);
              const viewerWhileActive = yield* inspect(
                viewerContext,
                yield* inspectSubject(worldRef, consultaKey)
              );
              expect(
                viewerWhileActive.frame.claims.length
              ).toBeGreaterThanOrEqual(2);
              // Staff correction context stays hidden from ordinary viewers.
              expect(viewerWhileActive.frame.scopedCorrections).toStrictEqual(
                []
              );

              const openRequest = yield* Schema.decodeEffect(OpenEvidence)({
                ...worldsEnvelope,
                input: { evidenceRef: importedAgenda.evidenceRef },
                operation: "OpenEvidence",
                worldRef,
              });
              const held = yield* Deferred.make<null>();
              const release = yield* Deferred.make<null>();
              const inner = yield* EvidenceObjectStore;
              const gatedStore = EvidenceObjectStore.of({
                locate: (input) => inner.locate(input),
                locateDocument: (input) => inner.locateDocument(input),
                read: (location) =>
                  Effect.gen(function* gatedRead() {
                    yield* Deferred.succeed(held, null);
                    yield* Deferred.await(release);
                    return yield* inner.read(location);
                  }),
                remove: (location) => inner.remove(location),
                stage: (input) => inner.stage(input),
                stageDocument: (input) => inner.stageDocument(input),
              });
              const pending = yield* Effect.forkScoped(
                openEvidence(viewerContext, openRequest).pipe(
                  Effect.provideService(EvidenceObjectStore, gatedStore),
                  Effect.result
                )
              );
              yield* Deferred.await(held);
              yield* revokeWorldReadAccess(
                ownerContext,
                yield* Schema.decodeEffect(RevokeWorldReadAccess)({
                  ...sharingEnvelope,
                  input: {
                    expectedRevision: granted.membershipAtCommit.revision,
                    principalRef: viewer.user.id,
                  },
                  operation: "RevokeWorldReadAccess",
                  operationId: randomUUID(),
                  worldRef,
                })
              );
              yield* Deferred.succeed(release, null);
              expect(yield* Fiber.join(pending)).toMatchObject({
                _tag: "Failure",
                failure: {
                  _tag: "NotFoundOrDenied",
                  code: "NOT_FOUND_OR_DENIED",
                },
              });

              // Viewer denied after revoke — no content disclosure.
              expect(
                yield* openEvidence(viewerContext, openRequest).pipe(
                  Effect.flip
                )
              ).toMatchObject({
                _tag: "NotFoundOrDenied",
                code: "NOT_FOUND_OR_DENIED",
              });
              expect(
                yield* inspect(
                  viewerContext,
                  yield* inspectSubject(worldRef, consultaKey)
                ).pipe(Effect.flip)
              ).toMatchObject({
                _tag: "NotFoundOrDenied",
                code: "NOT_FOUND_OR_DENIED",
              });

              // Other authorized administrative work remains intact for the owner.
              const stillAdmin = yield* inspect(
                ownerContext,
                yield* inspectSubject(worldRef, consultaKey)
              );
              expect(stillAdmin.frame.scopedCorrections).toHaveLength(1);
              expect(stillAdmin.frame.claims.length).toBeGreaterThanOrEqual(2);
              const opened = yield* openEvidence(ownerContext, openRequest);
              expect(opened._tag).toBe("EvidenceOpened");
              expect(opened.document).toContain("clinic.appointments");
              expect(opened.document.toLowerCase()).not.toMatch(
                /diagnos|treatment\.plan|clinical\.note/u
              );
            })
          ).pipe(
            Effect.provide(
              Layer.mergeAll(
                configuration,
                fixture.database.authority,
                fixture.runtime
              )
            )
          )
        );
      })
    )
);
