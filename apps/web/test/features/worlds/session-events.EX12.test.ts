import { expect, it } from "@effect/vitest";
import { Effect } from "effect";

import {
  announceSessionChange,
  watchSessionChanges,
} from "../../../src/features/worlds/session-events.ts";

it.effect(
  "session notification reaches a peer without echoing into its sender",
  () =>
    Effect.gen(function* sessionBroadcast() {
      const peer = new BroadcastChannel("zoen-worlds-session-change");
      let ownNotifications = 0;
      const stop = watchSessionChanges(() => {
        ownNotifications += 1;
      });
      try {
        yield* Effect.callback<boolean>((resume) => {
          peer.addEventListener(
            "message",
            () => {
              resume(Effect.succeed(true));
            },
            { once: true }
          );
          announceSessionChange();
        });
        expect(ownNotifications).toBe(0);
        yield* Effect.callback<boolean>((resume) => {
          const stopForeign = watchSessionChanges(() => {
            stopForeign();
            resume(Effect.succeed(true));
          });
          // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel has no targetOrigin argument.
          peer.postMessage("changed");
        });
        expect(ownNotifications).toBe(1);
      } finally {
        stop();
        peer.close();
      }
    })
);
