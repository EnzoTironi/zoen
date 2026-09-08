import { Membership } from "@zoen/contracts/sharing/operations";
import type { PrincipalRef } from "@zoen/contracts/sharing/operations";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { PrincipalId } from "../../ports/worlds/context.js";

export const principalIdFromRef = (reference: PrincipalRef) =>
  Schema.decodeEffect(PrincipalId)(reference).pipe(
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
/** Mutations hold the membership domain and disclosure locks before reading this row. */
export const readMembership = Effect.fn("authority.sharing.readMembership")(
  function* readMembership(
    world: WorldRef,
    principalId: typeof PrincipalId.Type
  ) {
    const sql = yield* SqlClient.SqlClient;
    const [row] =
      yield* sql`SELECT principal_id AS "principalRef", role, state, revision::text
      FROM authority.memberships WHERE world_id = ${world.worldId} AND realm = ${world.realm}
        AND principal_id = ${principalId}`;
    if (row === undefined) {
      return null;
    }
    return yield* Schema.decodeUnknownEffect(Membership)(row).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
);
