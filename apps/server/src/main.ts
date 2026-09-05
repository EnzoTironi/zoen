import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { httpListener } from "./adapters/http.ts";
import { makeD01Application } from "./composition.ts";
import { loadConfiguration } from "./configuration.ts";

const program = loadConfiguration.pipe(
  Effect.flatMap(({ application, listenHost, listenPort }) =>
    Layer.launch(
      HttpRouter.serve(makeD01Application(application), {
        disableLogger: true,
      }).pipe(Layer.provide(httpListener(listenHost, listenPort)))
    )
  ),
  Effect.provide(NodeServices.layer),
  Effect.tapCause(() => Effect.logError({ event: "server.failed" }))
);

NodeRuntime.runMain(program, { disableErrorReporting: true });
