import type { StorageFailure } from "@zoen/authority/ports/worlds/storage";
import { Context } from "effect";
import type { Effect } from "effect";

export class S3Health extends Context.Service<
  S3Health,
  { readonly check: Effect.Effect<void, StorageFailure> }
>()("zoen/server/adapters/object-storage/worlds/Health") {}
