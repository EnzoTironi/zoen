import { Schema } from "effect";

import type { AuthorityInstallationSchema } from "../../../../packages/ontology/src/commit/configuration.ts";
import type { DataPolicySchema } from "../../../../packages/ontology/src/ports/worlds/context.ts";

export const makeHttpProcessConfiguration = (
  installation: typeof AuthorityInstallationSchema,
  policy: typeof DataPolicySchema
) =>
  Schema.Struct({
    authorityUrl: Schema.String,
    controlPrefix: Schema.String,
    identityUrl: Schema.String,
    installation,
    policy,
    secret: Schema.String,
    storage: Schema.Struct({
      accessKeyId: Schema.String,
      bucket: Schema.String,
      endpoint: Schema.String,
      secretAccessKey: Schema.String,
    }),
  });

export const Barrier = Schema.Struct({
  key: Schema.String,
  kind: Schema.Literals(["before-shared", "before-end", "observe-exclusive"]),
});
