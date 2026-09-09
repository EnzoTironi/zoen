/**
 * Zoen hosted + local infra — alchemy.run as source of truth for Fly + Docker.
 *
 * Non-negotiables (mirror ops/fly/fly.toml; do not invent managed data plane):
 * - All-in-one only: app + Postgres + RustFS on volume `zoen_data` → `/data`
 * - REJECT Fly managed Postgres and Tigris/managed object storage
 * - Prod adopts live `zoen-rebuild` (retain); never destroy volume/DNS from here
 * - Exact-image CD (ZA-07) owns the admitted GHCR digest — set ZOEN_FLY_IMAGE;
 *   this stack must not rebuild/push a competing prod image
 *
 * Stages:
 * - `prod` — always-on enough for /ready (minMachinesRunning=1), RemovalPolicy.retain
 * - `local` / `local_*` — Docker Postgres (+ optional MinIO) only; zero Fly cost
 * - anything else (`dev_$USER`, `pr-N`, `staging`) — ephemeral Fly app, auto-stop, min 0
 *
 * Deploy: `pnpm alchemy:deploy -- --stage prod` (see ops/alchemy/README.md)
 */
import path from "node:path";

import * as Alchemy from "alchemy";
import * as Docker from "alchemy/Docker";
import * as Fly from "alchemy/Fly";
import { Stack } from "alchemy/Stack";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";

import {
  ephemeralFlyAppName,
  hostedPublicUrl,
  isLocalStage,
  isProdStage,
  sanitizeStageSlug,
} from "./stage.ts";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/** Non-secret env mirrored from ops/fly/fly.toml `[env]` (PUBLIC_URL is stage-aware). */
const hostedEnvBase = {
  ZOEN_ADMIT_HOSTED_RELEASE_UPGRADE: "true",
  ZOEN_BOOTSTRAP_ADMIN_URL: "postgresql://zoen_infra@127.0.0.1:5432/postgres",
  ZOEN_INSTALLATION_FILE: "/data/zoen/installation.json",
  ZOEN_LISTEN_HOST: "0.0.0.0",
  ZOEN_PORT: "4310",
  ZOEN_RUNTIME_ENV_FILE: "/data/zoen/runtime.env",
  ZOEN_S3_BUCKET: "zoen",
  ZOEN_S3_ENDPOINT: "http://127.0.0.1:9000",
  ZOEN_S3_REGION: "us-east-1",
  ZOEN_WORLD_POLICY: "worlds-hosted-retained-v1",
} as const;

const localDocker = (stage: string) =>
  Effect.gen(function* local() {
    const password = yield* Alchemy.makeRandom("LocalPostgresPassword", {
      bytes: 16,
    });
    const pgImage = yield* Docker.RemoteImage("postgres-image", {
      alwaysPull: false,
      name: "postgres",
      tag: "18-alpine",
    });
    const network = yield* Docker.Network("zoen-local-net");
    // Bind mounts under .local (avoid Docker.Volume plan bug on create when olds is undefined).
    const pgDataPath = path.join(
      repoRoot,
      ".local",
      "alchemy",
      sanitizeStageSlug(stage),
      "postgres"
    );
    const postgres = yield* Docker.Container("postgres", {
      environment: {
        POSTGRES_DB: "zoen",
        POSTGRES_PASSWORD: password,
        POSTGRES_USER: "zoen",
      },
      healthcheck: {
        cmd: ["CMD-SHELL", "pg_isready -U zoen -d zoen"],
        interval: "5 seconds",
        retries: 10,
        timeout: "5 seconds",
      },
      image: pgImage,
      name: `zoen-alchemy-${sanitizeStageSlug(stage)}-postgres`,
      networks: [{ aliases: ["postgres"], name: network.name }],
      // external: 0 → Docker picks a free host port (avoids stage/Compose collisions).
      ports: [{ external: 0, internal: 5432 }],
      start: true,
      volumes: [
        // Postgres 18 volume boundary is /var/lib/postgresql (not .../data).
        { containerPath: "/var/lib/postgresql", hostPath: pgDataPath },
      ],
    });

    const wantS3 = yield* Config.string("ZOEN_ALCHEMY_LOCAL_S3").pipe(
      Config.withDefault("1")
    );
    if (wantS3 === "0") {
      return {
        mode: "local-docker" as const,
        postgres: postgres.name,
        s3: null,
        stage,
      };
    }

    const minioImage = yield* Docker.RemoteImage("minio-image", {
      alwaysPull: false,
      name: "minio/minio",
      tag: "RELEASE.2025-07-23T15-54-02Z",
    });
    const minioDataPath = path.join(
      repoRoot,
      ".local",
      "alchemy",
      sanitizeStageSlug(stage),
      "minio"
    );
    const accessKey = yield* Alchemy.makeRandom("LocalS3AccessKey", {
      bytes: 12,
    });
    const secretKey = yield* Alchemy.makeRandom("LocalS3SecretKey", {
      bytes: 24,
    });
    const minio = yield* Docker.Container("minio", {
      command: ["server", "/data", "--console-address", ":9001"],
      environment: {
        MINIO_ROOT_PASSWORD: secretKey,
        MINIO_ROOT_USER: accessKey,
      },
      image: minioImage,
      name: `zoen-alchemy-${sanitizeStageSlug(stage)}-minio`,
      networks: [{ aliases: ["minio"], name: network.name }],
      ports: [
        { external: 0, internal: 9000 },
        { external: 0, internal: 9001 },
      ],
      start: true,
      volumes: [{ containerPath: "/data", hostPath: minioDataPath }],
    });

    return {
      mode: "local-docker" as const,
      postgres: postgres.name,
      s3: minio.name,
      stage,
    };
  });

const flyHosted = (stage: string, prod: boolean) =>
  Effect.gen(function* fly() {
    const appName = prod ? "zoen-rebuild" : ephemeralFlyAppName(stage);
    const publicUrl = hostedPublicUrl(stage, prod);

    // Break-glass / ephemeral may build all-in-one and push to Fly registry.
    // Prod must NOT fight ZA-07 exact-image CD unless ZOEN_ALCHEMY_BREAK_GLASS=1.
    const image = yield* Effect.gen(function* resolveImage() {
      const breakGlass = yield* Config.string("ZOEN_ALCHEMY_BREAK_GLASS").pipe(
        Config.withDefault("0")
      );
      if (prod && breakGlass !== "1") {
        return yield* Config.string("ZOEN_FLY_IMAGE");
      }
      if (prod) {
        const admitted = yield* Config.string("ZOEN_FLY_IMAGE").pipe(
          Config.option
        );
        if (Option.isSome(admitted)) {
          return admitted.value;
        }
      }
      const flyToken = yield* Config.redacted("FLY_API_TOKEN");
      const built = yield* Docker.Image("all-in-one", {
        build: {
          context: repoRoot,
          dockerfile: "ops/containers/all-in-one.Dockerfile",
          platform: "linux/amd64",
        },
        name: appName,
        registry: {
          password: flyToken,
          server: "registry.fly.io",
          username: "x",
        },
        skipPush: false,
        tag: sanitizeStageSlug(stage),
      });
      // imageRef includes registry host after push (repoDigest is Output-wrapped).
      return built.imageRef;
    });

    const app = yield* Fly.App("App", { name: appName }).pipe(
      Alchemy.RemovalPolicy.retain(prod)
    );

    yield* Fly.IpAssignment("Ipv4", {
      app,
      type: "shared_v4",
    }).pipe(Alchemy.RemovalPolicy.retain(prod));

    const authSecret = prod
      ? yield* Config.redacted("ZOEN_AUTH_SECRET")
      : yield* Alchemy.makeRandom("AuthSecret", { bytes: 32 });
    const s3Access = prod
      ? yield* Config.redacted("ZOEN_S3_ACCESS_KEY")
      : Redacted.make("zoenlocal");
    const s3Secret = prod
      ? yield* Config.redacted("ZOEN_S3_SECRET_KEY")
      : Redacted.make("zoenlocal-secret-key-min-32b");

    yield* Fly.Secret("AuthSecret", {
      app,
      name: "ZOEN_AUTH_SECRET",
      value: authSecret,
    }).pipe(Alchemy.RemovalPolicy.retain(prod));
    yield* Fly.Secret("S3AccessKey", {
      app,
      name: "ZOEN_S3_ACCESS_KEY",
      value: s3Access,
    }).pipe(Alchemy.RemovalPolicy.retain(prod));
    yield* Fly.Secret("S3SecretKey", {
      app,
      name: "ZOEN_S3_SECRET_KEY",
      value: s3Secret,
    }).pipe(Alchemy.RemovalPolicy.retain(prod));

    // Ready-check payload is declared in ./stage.ts (parity with fly.toml).
    // Alchemy MachineService→Fly mapper does not yet forward `checks`; keep
    // transitional fly.toml checks for CD until Alchemy supports service checks.
    const machine = yield* Fly.Machine("AllInOne", {
      app,
      env: { ...hostedEnvBase, ZOEN_PUBLIC_URL: publicUrl },
      guest: { cpuKind: "shared", cpus: 1, memoryMb: 2048 },
      image,
      mounts: [
        {
          name: prod
            ? "zoen_data"
            : `zoen_data_${sanitizeStageSlug(stage).replaceAll("-", "_")}`.slice(
                0,
                30
              ),
          path: "/data",
          sizeGb: 10,
        },
      ],
      region: "gru",
      restart: { policy: "always" },
      services: [
        {
          autostart: true,
          autostop: "stop",
          internalPort: 4310,
          minMachinesRunning: prod ? 1 : 0,
          ports: [
            { forceHttps: true, handlers: ["http"], port: 80 },
            { handlers: ["tls", "http"], port: 443 },
          ],
          protocol: "tcp",
        },
      ],
    }).pipe(Alchemy.RemovalPolicy.retain(prod));

    // Alchemy MachineService mapper does not forward Fly service `checks` yet.
    // When enabled (preview CI), poll /ready so deploy does not return before boot.
    const waitReady = yield* Config.string("ZOEN_ALCHEMY_WAIT_READY").pipe(
      Config.withDefault("0")
    );
    if (waitReady === "1") {
      const readyUrl = `${publicUrl}/ready`;
      yield* Effect.gen(function* awaitReady() {
        let ready = false;
        for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
          ready = yield* Effect.tryPromise(() =>
            fetch(readyUrl, { signal: AbortSignal.timeout(5000) }).then(
              (response) => response.status === 200
            )
          ).pipe(Effect.orElseSucceed(() => false));
          if (!ready) {
            yield* Effect.sleep("2 seconds");
          }
        }
        if (!ready) {
          return yield* Effect.die(
            new Error(`Alchemy Fly Machine ready timeout url=${readyUrl}`)
          );
        }
        return null;
      });
    }

    return {
      appName,
      image,
      mode: "fly" as const,
      publicUrl,
      stage,
      url: machine.url,
    };
  });

export default Alchemy.Stack(
  "Zoen",
  {
    providers: Layer.mergeAll(
      Fly.providers(),
      Docker.providers(),
      Alchemy.RandomProvider()
    ),
    state: Alchemy.localState(),
  },
  Effect.gen(function* zoenStack() {
    const stack = yield* Stack;
    const { stage } = stack;
    if (isLocalStage(stage)) {
      return yield* localDocker(stage);
    }
    return yield* flyHosted(stage, isProdStage(stage));
  })
);
