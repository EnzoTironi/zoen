/**
 * Independently observed hosted install identity (app/bucket/volume/install).
 * imageDigest is NEVER taken from here — handlers bind
 * AuthorityInstallation.releaseDigest when building candidates.
 * Unbound in production composition so Closing/purge stay refused without H-02.
 */
import { Context, Effect, Layer } from "effect";

export interface HostedErasableObservedFields {
  readonly appName: string;
  readonly bucketName: string;
  readonly installId: string;
  readonly volumeName: string;
}

export class HostedErasableObservedIdentity extends Context.Service<
  HostedErasableObservedIdentity,
  {
    readonly observe: Effect.Effect<HostedErasableObservedFields | null>;
  }
>()("zoen/authority/hosted/erasable/HostedErasableObservedIdentity") {
  static readonly unboundLayer = Layer.succeed(
    HostedErasableObservedIdentity,
    HostedErasableObservedIdentity.of({
      observe: Effect.succeed(null),
    })
  );

  static readonly boundLayer = (fields: HostedErasableObservedFields) =>
    Layer.succeed(
      HostedErasableObservedIdentity,
      HostedErasableObservedIdentity.of({
        observe: Effect.succeed(fields),
      })
    );
}
