import { Schema } from "effect";

import type { AuthorityInstallationSchema } from "../../../packages/authority/src/commit/configuration.ts";
import type { DataPolicySchema } from "../../../packages/authority/src/ports/d01/context.ts";

export const makeProcessConfiguration = (
  installation: typeof AuthorityInstallationSchema,
  policy: typeof DataPolicySchema
) =>
  Schema.Struct({
    authorityUrl: Schema.String,
    credential: Schema.String,
    family: Schema.optional(Schema.Literals(["d01", "correction", "sharing"])),
    identity: Schema.Struct({
      baseUrl: Schema.String,
      databaseUrl: Schema.String,
      secret: Schema.String,
      sessionSeconds: Schema.Finite,
    }),
    installation,
    policy,
    request: Schema.String,
    storage: Schema.Struct({
      accessKeyId: Schema.String,
      bucket: Schema.String,
      endpoint: Schema.String,
      secretAccessKey: Schema.String,
    }),
  });
