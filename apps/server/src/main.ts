import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { HttpRouter } from "effect/unstable/http";

import { httpListener } from "./adapters/http.ts";
import { makeD01Application } from "./composition.ts";
import { loadConfiguration } from "./configuration.ts";
import { webRoutes } from "./http/web.ts";
import { logServerFailed, serverMainRuntimeOptions } from "./server-failed.ts";

const program = loadConfiguration.pipe(
  Effect.flatMap(({ application, listenHost, listenPort }) =>
    Layer.launch(
      HttpRouter.serve(
        Layer.mergeAll(makeD01Application(application), webRoutes),
        {
          disableLogger: true,
        }
      ).pipe(Layer.provide(httpListener(listenHost, listenPort)))
    )
  ),
  Effect.provide(NodeServices.layer),
  Effect.tapCause((cause) => logServerFailed(cause))
);

NodeRuntime.runMain(program, serverMainRuntimeOptions);
