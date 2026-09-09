import { describe, expect, it } from "vitest";

import {
  FLY_HTTP_READY_CHECK,
  ephemeralFlyAppName,
  flyHttpReadyCheckPayload,
  hostedPublicUrl,
  isLocalStage,
  isProdStage,
  sanitizeStageSlug,
} from "./stage.ts";

describe("ops/alchemy stage helpers", () => {
  it("classifies prod stages", () => {
    expect(isProdStage("prod")).toBeTruthy();
    expect(isProdStage("staging")).toBeFalsy();
  });

  it("classifies local stages", () => {
    expect(isLocalStage("local")).toBeTruthy();
    expect(isLocalStage("local_enzo")).toBeTruthy();
    expect(isLocalStage("pr-12")).toBeFalsy();
    expect(isLocalStage("prod")).toBeFalsy();
  });

  it("sanitizes unsafe stage strings", () => {
    expect(sanitizeStageSlug("Dev_Enzo!!")).toBe("dev-enzo");
    expect(sanitizeStageSlug("pr-115")).toBe("pr-115");
    expect(sanitizeStageSlug("---a---")).toBe("a");
  });

  it("keeps short ephemeral app names readable and unique when truncated", () => {
    expect(ephemeralFlyAppName("pr-115")).toBe("zoen-pr-115");
    const longA = ephemeralFlyAppName(
      "dev_very_long_stage_name_that_collides_aaa"
    );
    const longB = ephemeralFlyAppName(
      "dev_very_long_stage_name_that_collides_bbb"
    );
    expect(longA.length).toBeLessThanOrEqual(30);
    expect(longB.length).toBeLessThanOrEqual(30);
    expect(longA).not.toBe(longB);
    expect(longA).toMatch(/^zoen-[a-z0-9-]+-[a-f0-9]{6}$/u);
  });

  it("uses production origin only for prod stages", () => {
    expect(hostedPublicUrl("prod", true)).toBe("https://zoen.tironi.xyz");
    expect(hostedPublicUrl("pr-9", false)).toBe("https://zoen-pr-9.fly.dev");
  });

  it("mirrors fly.toml ready-check semantics for Machine payloads", () => {
    expect(FLY_HTTP_READY_CHECK).toMatchObject({
      gracePeriod: "1m",
      interval: "15s",
      method: "GET",
      path: "/ready",
      timeout: "5s",
    });
    expect(flyHttpReadyCheckPayload()).toMatchObject({
      grace_period: "1m",
      interval: "15s",
      method: "GET",
      path: "/ready",
      timeout: "5s",
    });
  });
});
