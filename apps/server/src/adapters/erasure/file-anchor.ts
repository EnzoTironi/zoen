import { randomBytes } from "node:crypto";

import { Unavailable } from "@zoen/contracts/worlds/errors";
import { ErasureExternalAnchor } from "@zoen/ontology/ports/erasure/anchor";
import { Effect, FileSystem, Layer, Path, Schedule, Schema } from "effect";

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });
const isUnavailable = Schema.is(Unavailable);

const parseSequence = (raw: string): bigint | null => {
  const trimmed = raw.trim();
  if (!/^[0-9]+$/u.test(trimmed)) {
    return null;
  }
  try {
    return BigInt(trimmed);
  } catch {
    return null;
  }
};

const mapPlatform = (error: unknown): Unavailable =>
  isUnavailable(error) ? error : unavailable();

/**
 * Durable file-backed monotone anchor for the local narrow controller profile.
 * Place the path on a volume/directory that is not restored with the controller
 * PostgreSQL data directory.
 *
 * Advances are serialized with an exclusive lock file and use unique temporary
 * names so concurrent processes cannot regress the admitted sequence.
 */
export const fileErasureExternalAnchorLayer = (
  absolutePath: string
): Layer.Layer<
  ErasureExternalAnchor,
  never,
  FileSystem.FileSystem | Path.Path
> =>
  Layer.effect(
    ErasureExternalAnchor,
    Effect.gen(function* buildFileAnchor() {
      const fs = yield* FileSystem.FileSystem;
      const pathApi = yield* Path.Path;
      const directory = pathApi.dirname(absolutePath);
      const lockPath = `${absolutePath}.lock`;

      const ensureDirectory = fs.makeDirectory(directory, { recursive: true });

      const readSequence = Effect.gen(function* readAdmitted() {
        const exists = yield* fs.exists(absolutePath);
        if (!exists) {
          return 0n;
        }
        const raw = yield* fs.readFileString(absolutePath);
        const current = parseSequence(raw === "" ? "0" : raw);
        if (current === null) {
          return yield* unavailable();
        }
        return current;
      }).pipe(Effect.mapError(mapPlatform));

      const writeSequence = (sequence: bigint) =>
        Effect.gen(function* durableReplace() {
          const temporary = `${absolutePath}.${randomBytes(8).toString("hex")}.tmp`;
          yield* fs.writeFileString(temporary, `${sequence.toString()}\n`, {
            mode: 0o600,
          });
          yield* fs.rename(temporary, absolutePath);
        }).pipe(Effect.mapError(mapPlatform));

      const acquireLock = fs
        .writeFileString(lockPath, "1\n", { flag: "wx", mode: 0o600 })
        .pipe(
          Effect.retry({
            schedule: Schedule.spaced("20 millis"),
            times: 49,
          }),
          Effect.mapError(mapPlatform)
        );

      const withExclusiveLock = <A>(
        body: Effect.Effect<A, Unavailable>
      ): Effect.Effect<A, Unavailable> =>
        Effect.gen(function* locked() {
          yield* ensureDirectory.pipe(Effect.mapError(mapPlatform));
          yield* acquireLock;
          return yield* body.pipe(
            Effect.ensuring(
              fs.remove(lockPath, { force: true }).pipe(Effect.ignore)
            )
          );
        });

      return ErasureExternalAnchor.of({
        advance: (sequence) =>
          withExclusiveLock(
            Effect.gen(function* advanceAnchor() {
              const current = yield* readSequence;
              if (sequence < current) {
                return yield* unavailable();
              }
              const next = sequence > current ? sequence : current;
              const exists = yield* fs
                .exists(absolutePath)
                .pipe(Effect.mapError(mapPlatform));
              if (next !== current || !exists) {
                yield* writeSequence(next);
              }
              return { admittedSequence: next };
            })
          ),
        inspect: withExclusiveLock(
          Effect.gen(function* inspectAnchor() {
            const current = yield* readSequence;
            const exists = yield* fs
              .exists(absolutePath)
              .pipe(Effect.mapError(mapPlatform));
            if (!exists) {
              yield* writeSequence(0n);
            }
            return { admittedSequence: current };
          })
        ),
      });
    })
  );
