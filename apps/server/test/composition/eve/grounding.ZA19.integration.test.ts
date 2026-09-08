import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import {
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { SubjectKey } from "@zoen/contracts/worlds/values";
import {
  basesAgreeSemantically,
  groundedBasisFromFrame,
} from "@zoen/ontology/semantic/grounding";
import { Effect, Redacted, Schema } from "effect";

import { admitDomainToolCall } from "../../../src/eve/domain-tools.ts";
import {
  http,
  jsonBody,
  responseCookie,
  withWorldsHttp,
} from "../worlds/fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const envelope = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const executePath = "/api/worlds/execute";

const document = (source: string, amount: string) =>
  json({
    records: [
      {
        externalId: "obligation-1",
        predicate: "obligation.amount",
        subjectKey: "obligation-1",
        validTime: {
          _tag: "DateInterval",
          from: "2026-09-01",
          to: "2026-10-01",
        },
        value: { _tag: "Known", amount, currency: "BRL" },
      },
    ],
    schemaVersion: "worlds.v1",
    source: {
      externalId: source,
      label: source,
      namespace: "za19-grounding",
      revision: "1",
    },
  });

it.live(
  "ZA-19-01 same actor/basis: UI Inspect and Eve tool projection agree on contested commitment",
  () =>
    withWorldsHttp(({ origin }) =>
      Effect.gen(function* za1901() {
        const email = `${randomUUID()}@example.test`;
        const password = Redacted.make(randomBytes(24).toString("base64url"));
        const credentials = { email, password: Redacted.value(password) };
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({ ...credentials, name: "ZA19" })
        );
        expect(signup.status).toBe(200);
        const owner = responseCookie(signup);

        const create = yield* http(
          origin,
          executePath,
          json({
            ...envelope,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          owner
        );
        const created = yield* jsonBody(create).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );
        expect(create.status).toBe(200);

        for (const [source, amount] of [
          ["billing", "100.00"],
          ["bank-statement", "200.00"],
        ] as const) {
          const imported = yield* http(
            origin,
            executePath,
            json({
              ...envelope,
              input: { document: document(source, amount) },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef: created.worldRef,
            }),
            owner
          );
          expect(imported.status).toBe(200);
        }

        // Direct UI/CLI path: Inspect
        const inspect = yield* http(
          origin,
          executePath,
          json({
            ...envelope,
            input: { atFrame: null, subjectKey: "obligation-1" },
            operation: "Inspect",
            worldRef: created.worldRef,
          }),
          owner
        );
        const frame = yield* jsonBody(inspect).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
        );
        expect(frame.frame.contested).toBeTruthy();
        expect(frame.frame.claims).toHaveLength(2);

        // Eve tool path: admitted inspect_subject projects the same authorized basis
        const tool = yield* admitDomainToolCall({
          arguments: { subjectKey: "obligation-1" },
          name: "inspect_subject",
        });
        expect(tool.arguments.subjectKey).toBe(
          Schema.decodeSync(SubjectKey)("obligation-1")
        );
        const eveBasis = yield* groundedBasisFromFrame(frame);
        expect(basesAgreeSemantically(eveBasis, frame)).toBeTruthy();
        expect({
          contested: eveBasis.contested,
          factCount: eveBasis.facts.length,
          referenceCount: eveBasis.references.length,
          uncertainty: eveBasis.uncertainty,
        }).toStrictEqual({
          contested: true,
          factCount: 2,
          referenceCount: 2,
          uncertainty: "Partial",
        });

        // ZA-19-02 on the live seam: forged tool JSON denied
        const forged = yield* Effect.exit(
          admitDomainToolCall({
            arguments: { subjectKey: "obligation-1" },
            name: "raw_sql",
            query: "SELECT * FROM authority.claims",
          })
        );
        expect(forged._tag).toBe("Failure");
      })
    )
);
