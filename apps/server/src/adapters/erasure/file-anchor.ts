import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { ErasureExternalAnchor } from "@zoen/authority/ports/erasure/anchor";
import { Unavailable } from "@zoen/contracts/worlds/errors";
import { Effect, Layer, Schema } from "effect";

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

const mapUnavailable = (error: unknown): Unavailable =>
  isUnavailable(error) ? error : unavailable();

/**
 * Durable file-backed monotone anchor for the local narrow controller profile.
 * Place the path on a volume/directory that is not restored with the controller
 * PostgreSQL data directory.
 */
export const fileErasureExternalAnchorLayer = (
  absolutePath: string
): Layer.Layer<ErasureExternalAnchor> =>
  Layer.succeed(
    ErasureExternalAnchor,
    ErasureExternalAnchor.of({
      advance: (sequence) =>
        Effect.tryPromise({
          catch: mapUnavailable,
          try: async () => {
            await mkdir(path.dirname(absolutePath), { recursive: true });
            const existing = await readFile(absolutePath, "utf-8").catch(
              () => "0"
            );
            const current = parseSequence(existing === "" ? "0" : existing);
            if (current === null) {
              throw unavailable();
            }
            if (sequence < current) {
              throw unavailable();
            }
            const next = sequence > current ? sequence : current;
            const temporary = `${absolutePath}.tmp`;
            await writeFile(temporary, `${next.toString()}\n`, "utf-8");
            await rename(temporary, absolutePath);
            return { admittedSequence: next };
          },
        }),
      inspect: () =>
        Effect.tryPromise({
          catch: mapUnavailable,
          try: async () => {
            await mkdir(path.dirname(absolutePath), { recursive: true });
            const raw = await readFile(absolutePath, "utf-8").catch(() => "0");
            const current = parseSequence(raw === "" ? "0" : raw);
            if (current === null) {
              throw unavailable();
            }
            if (raw === "" || raw === "0" || raw === "0\n") {
              await writeFile(absolutePath, "0\n", "utf-8");
            }
            return { admittedSequence: current };
          },
        }),
    })
  );
