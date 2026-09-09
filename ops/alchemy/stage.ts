/**
 * Pure stage helpers for the Alchemy Fly+Docker stack.
 * Kept free of alchemy/effect imports so unit tests stay hermetic.
 */
import { createHash } from "node:crypto";

/** Fly HTTP readiness check mirrored from ops/fly/fly.toml `[http_service.checks]`. */
export const FLY_HTTP_READY_CHECK = {
  gracePeriod: "1m",
  interval: "15s",
  method: "GET",
  path: "/ready",
  timeout: "5s",
} as const;

export const isProdStage = (stage: string): boolean => stage === "prod";

export const isLocalStage = (stage: string): boolean =>
  stage === "local" || stage.startsWith("local_");

export const sanitizeStageSlug = (stage: string): string =>
  stage
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]/gu, "-")
    .replaceAll(/-+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "");

/**
 * Fly app names are globally unique and max 30 chars. Prefer the readable
 * `zoen-<slug>` form; when truncated, keep a short hash so distinct long
 * stages cannot collide on the same prefix.
 */
export const ephemeralFlyAppName = (stage: string): string => {
  const slug = sanitizeStageSlug(stage);
  const preferred = `zoen-${slug}`;
  if (preferred.length <= 30) {
    return preferred;
  }
  const hash = createHash("sha256").update(stage).digest("hex").slice(0, 6);
  const budget = 30 - 1 - hash.length;
  const prefix = preferred.slice(0, budget).replace(/-+$/u, "");
  return `${prefix}-${hash}`;
};

export const hostedPublicUrl = (stage: string, prod: boolean): string =>
  prod
    ? "https://zoen.tironi.xyz"
    : `https://${ephemeralFlyAppName(stage)}.fly.dev`;

/** Fly Machine service check payload (snake_case) matching FLY_HTTP_READY_CHECK. */
export const flyHttpReadyCheckPayload = () => ({
  grace_period: FLY_HTTP_READY_CHECK.gracePeriod,
  interval: FLY_HTTP_READY_CHECK.interval,
  method: FLY_HTTP_READY_CHECK.method,
  path: FLY_HTTP_READY_CHECK.path,
  timeout: FLY_HTTP_READY_CHECK.timeout,
});
