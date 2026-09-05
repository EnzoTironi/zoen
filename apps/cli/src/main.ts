import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import { d01Command } from "./d01/command.ts";

NodeRuntime.runMain(
  Command.run(d01Command, { version: "0.0.0" }).pipe(
    Effect.provide(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer))
  )
);
