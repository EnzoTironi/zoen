import { Revision, exact } from "@zoen/contracts/worlds/values";
import { Context, Schema } from "effect";

import { Head } from "../ports/worlds/basis.js";

export const AuthorityInstallationSchema = Schema.Struct({
  cellEpoch: Revision,
  cellId: Schema.String.check(Schema.isUUID()),
  generationId: Schema.String.check(Schema.isUUID()),
  releaseDigest: Head.fields.releaseDigest,
}).annotate(exact);

export class AuthorityInstallation extends Context.Service<
  AuthorityInstallation,
  typeof AuthorityInstallationSchema.Type
>()("zoen/ontology/commit/AuthorityInstallation") {}
