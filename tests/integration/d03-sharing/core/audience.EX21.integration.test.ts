import { randomUUID } from "node:crypto";

import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  sdk,
  withStorage,
} from "../../../../apps/server/test/adapters/object-storage/d01/fixture.js";
import { createAccount } from "../../../../apps/server/test/identity/d01/http.js";
import { inspectWorldAccess } from "../../../../packages/authority/src/access/sharing/inspect.js";
import {
  grantWorldReadAccess,
  revokeWorldReadAccess,
} from "../../../../packages/authority/src/access/sharing/mutation.js";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import { importEvidence } from "../../../../packages/authority/src/evidence/d01/import.js";
import { openEvidence } from "../../../../packages/authority/src/evidence/d01/open.js";
import { answerQuestion } from "../../../../packages/authority/src/knowledge/corrections/answer.js";
import { proposeCorrection } from "../../../../packages/authority/src/knowledge/corrections/propose.js";
import { undoCorrection } from "../../../../packages/authority/src/knowledge/corrections/undo.js";
import { inspect } from "../../../../packages/authority/src/knowledge/d01/inspect.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";
import {
  AnswerQuestion,
  ImportEvidence,
  Inspect,
  OpenEvidence,
  ProposeCorrection,
  UndoCorrection,
} from "../../../../packages/contracts/src/d01/operations.js";
import {
  GrantWorldReadAccess,
  InspectWorldAccess,
  RevokeWorldReadAccess,
} from "../../../../packages/contracts/src/sharing/operations.js";
import { configuration } from "../../d01/commit/fixture.js";
import {
  genesisRequest,
  verifiedContext,
  withSharingDatabase,
} from "./fixture.js";

it.live(
  "SH-01–03 viewer reads retained and future evidence but cannot observe owner decisions or mutate, including retries",
  () =>
    withSharingDatabase((fixture) =>
      withStorage(({ client, config }) =>
        Effect.gen(function* sharedAudience() {
          const owner = yield* createAccount(fixture.config.baseUrl);
          const viewer = yield* createAccount(fixture.config.baseUrl);
          const stranger = yield* createAccount(fixture.config.baseUrl);
          const ownerContext = yield* verifiedContext(owner.credential);
          const viewerContext = yield* verifiedContext(viewer.credential);
          const strangerContext = yield* verifiedContext(stranger.credential);
          const genesis = yield* genesisRequest;
          const { worldRef } = yield* createPersonalWorld(
            ownerContext,
            genesis
          );
          const document = yield* canonicalJson({
            records: [
              {
                externalId: "row-1",
                predicate: "obligation.amount",
                subjectKey: "billing",
                validTime: {
                  _tag: "DateInterval",
                  from: "2026-09-01",
                  to: "2026-10-01",
                },
                value: { _tag: "Known", amount: "100", currency: "BRL" },
              },
            ],
            schemaVersion: "d01.v1",
            source: {
              externalId: "original",
              label: "Retained source",
              namespace: "manual",
              revision: "1",
            },
          });
          const importRequest = yield* Schema.decodeEffect(ImportEvidence)({
            ...genesis,
            input: { document },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            worldRef,
          });
          const imported = yield* importEvidence(ownerContext, importRequest);
          const read = yield* Schema.decodeEffect(Inspect)({
            input: { atFrame: null, subjectKey: "billing" },
            operation: "Inspect",
            purpose: "personal-records",
            schemaVersion: "d01.v1",
            worldRef,
          });
          const ownerFrame = yield* inspect(ownerContext, read);
          const proposalRequest = yield* Schema.decodeEffect(ProposeCorrection)(
            {
              ...genesis,
              input: {
                consequence: {
                  choice: { _tag: "unknown" },
                  subjectKey: "billing",
                  validTime: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
                },
                frameRef: ownerFrame.frame.frameRef,
              },
              operation: "ProposeCorrection",
              operationId: randomUUID(),
              worldRef,
            }
          );
          const proposed = yield* proposeCorrection(
            ownerContext,
            proposalRequest
          );
          const answerRequest = yield* Schema.decodeEffect(AnswerQuestion)({
            ...genesis,
            input: {
              answer: "unknown",
              consequenceDigest: proposed.consequenceDigest,
              questionRef: proposed.questionRef,
            },
            operation: "AnswerQuestion",
            operationId: randomUUID(),
            worldRef,
          });
          const answered = yield* answerQuestion(ownerContext, answerRequest);
          expect(
            (yield* inspect(ownerContext, read)).frame.scopedCorrections
          ).toHaveLength(1);
          const grant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
            input: { expectedRevision: null, principalRef: viewer.user.id },
            operation: "GrantWorldReadAccess",
            operationId: randomUUID(),
            purpose: "personal-records",
            schemaVersion: "d03.sharing.v1",
            worldRef,
          });
          yield* grantWorldReadAccess(ownerContext, grant);
          const self = yield* Schema.decodeEffect(InspectWorldAccess)({
            input: { principalRef: null },
            operation: "InspectWorldAccess",
            purpose: "personal-records",
            schemaVersion: "d03.sharing.v1",
            worldRef,
          });
          expect(
            (yield* inspectWorldAccess(viewerContext, self)).membership
          ).toStrictEqual({
            principalRef: viewer.user.id,
            revision: "0",
            role: "viewer",
            state: "active",
          });
          const initialViewer = yield* inspect(viewerContext, read);
          expect(initialViewer.frame.claims).toStrictEqual(
            ownerFrame.frame.claims
          );
          expect(initialViewer.frame.scopedCorrections).toStrictEqual([]);
          const open = yield* Schema.decodeEffect(OpenEvidence)({
            ...read,
            input: { evidenceRef: imported.evidenceRef },
            operation: "OpenEvidence",
          });
          expect(yield* openEvidence(viewerContext, open)).toStrictEqual({
            _tag: "EvidenceOpened",
            document,
            evidenceRef: imported.evidenceRef,
            mediaType: "application/json",
          });
          const futureDocument = document.replace('"original"', '"future"');
          const futureImport = yield* Schema.decodeEffect(ImportEvidence)({
            ...importRequest,
            input: { document: futureDocument },
            operationId: randomUUID(),
          });
          const future = yield* importEvidence(ownerContext, futureImport);
          expect(
            (yield* inspect(viewerContext, read)).frame.claims
          ).toHaveLength(2);
          expect(
            (yield* openEvidence(viewerContext, {
              ...open,
              input: { evidenceRef: future.evidenceRef },
            })).document
          ).toBe(futureDocument);
          const beforeHiddenChange = yield* inspect(viewerContext, read);
          const freshOwner = yield* inspect(ownerContext, read);
          const undoRequest = yield* Schema.decodeEffect(UndoCorrection)({
            ...genesis,
            input: {
              correctionRef: answered.correctionRef,
              frameRef: freshOwner.frame.frameRef,
            },
            operation: "UndoCorrection",
            operationId: randomUUID(),
            worldRef,
          });
          yield* undoCorrection(ownerContext, undoRequest);
          const afterHiddenChange = yield* inspect(viewerContext, read);
          expect({
            ...afterHiddenChange.frame,
            frameRef: beforeHiddenChange.frame.frameRef,
          }).toStrictEqual(beforeHiddenChange.frame);
          const sql = yield* SqlClient.SqlClient;
          const counts = sql`SELECT
      (SELECT count(*)::int FROM jobs.captures) AS captures,
      (SELECT count(*)::int FROM authority.cases) AS cases,
      (SELECT count(*)::int FROM authority.corrections) AS corrections,
      (SELECT count(*)::int FROM authority.memberships) AS memberships,
      (SELECT count(*)::int FROM authority.receipts) AS receipts,
      (SELECT count(*)::int FROM jobs.outbox) AS outbox`;
          const before = yield* counts;
          const objects = () =>
            sdk((signal) =>
              client.send(new ListObjectsV2Command({ Bucket: config.bucket }), {
                abortSignal: signal,
              })
            ).pipe(Effect.map((result) => result.Contents));
          const retainedBefore = yield* objects();
          const revoke = yield* Schema.decodeEffect(RevokeWorldReadAccess)({
            ...grant,
            input: { ...grant.input, expectedRevision: "0" },
            operation: "RevokeWorldReadAccess",
            operationId: randomUUID(),
          });
          const privateFrame = {
            ...read,
            input: { ...read.input, atFrame: ownerFrame.frame.frameRef },
          };
          const deniedResults = yield* Effect.all(
            [
              importEvidence(viewerContext, importRequest),
              proposeCorrection(viewerContext, {
                ...proposalRequest,
                input: {
                  ...proposalRequest.input,
                  frameRef: initialViewer.frame.frameRef,
                },
              }),
              answerQuestion(viewerContext, answerRequest),
              undoCorrection(viewerContext, undoRequest),
              grantWorldReadAccess(viewerContext, grant),
              revokeWorldReadAccess(viewerContext, revoke),
              inspectWorldAccess(viewerContext, {
                ...self,
                input: {
                  principalRef: yield* Schema.decodeEffect(
                    GrantWorldReadAccess.fields.input.fields.principalRef
                  )(owner.user.id),
                },
              }),
              inspect(viewerContext, privateFrame),
              inspect(strangerContext, read),
              openEvidence(strangerContext, open),
              inspectWorldAccess(strangerContext, self),
            ],
            { concurrency: 1, mode: "result" }
          );
          for (const denied of deniedResults) {
            expect(denied).toMatchObject({
              _tag: "Failure",
              failure: { _tag: "NotFoundOrDenied" },
            });
          }
          expect(yield* counts).toStrictEqual(before);
          expect(yield* objects()).toStrictEqual(retainedBefore);
          const ownHistorical = {
            ...read,
            input: { ...read.input, atFrame: initialViewer.frame.frameRef },
          };
          yield* revokeWorldReadAccess(ownerContext, revoke);
          expect(
            yield* inspect(viewerContext, ownHistorical).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          expect(
            yield* openEvidence(viewerContext, open).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
          const regrant = yield* Schema.decodeEffect(GrantWorldReadAccess)({
            ...grant,
            input: { ...grant.input, expectedRevision: "1" },
            operationId: randomUUID(),
          });
          yield* grantWorldReadAccess(ownerContext, regrant);
          expect(yield* inspect(viewerContext, ownHistorical)).toStrictEqual(
            initialViewer
          );
          expect(
            yield* inspect(ownerContext, ownHistorical).pipe(Effect.flip)
          ).toMatchObject({ _tag: "NotFoundOrDenied" });
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              configuration,
              fixture.database.authority,
              fixture.runtime
            )
          )
        )
      )
    )
);
