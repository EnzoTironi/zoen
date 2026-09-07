import { StorageFailure } from "@zoen/authority/ports/worlds/storage";
import { D01_LIMITS, exact } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

const Timeout = Schema.Int.check(
  Schema.isGreaterThan(0),
  Schema.isLessThanOrEqualTo(D01_LIMITS.requestSeconds * 1000)
);
export const S3EvidenceConfig = Schema.Struct({
  bucket: Schema.String.check(
    Schema.isPattern(/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/u)
  ),
  connectionTimeoutMillis: Timeout,
  credentials: Schema.Struct({
    accessKeyId: Schema.Redacted(Schema.NonEmptyString),
    secretAccessKey: Schema.Redacted(Schema.NonEmptyString),
  }).annotate(exact),
  endpoint: Schema.URL.check(
    Schema.makeFilter(
      (url) =>
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.username === "" &&
        url.password === "" &&
        url.search === "" &&
        url.hash === "" &&
        url.pathname === "/"
    )
  ),
  forcePathStyle: Schema.Boolean,
  realm: Schema.Literal("live"),
  region: Schema.String.check(Schema.isPattern(/^[a-z0-9-]{1,63}$/u)),
  requestTimeoutMillis: Timeout,
})
  .check(
    Schema.makeFilter(
      (config) => config.connectionTimeoutMillis <= config.requestTimeoutMillis
    )
  )
  .annotate(exact);
export type S3EvidenceConfig = typeof S3EvidenceConfig.Type;

export const decodeConfig = (config: S3EvidenceConfig) =>
  Schema.decodeEffect(S3EvidenceConfig)(config).pipe(
    Effect.mapError(() => new StorageFailure({ reason: "InvalidInput" }))
  );
