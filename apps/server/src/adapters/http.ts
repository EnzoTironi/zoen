import { createServer } from "node:http";

import { NodeHttpServer } from "@effect/platform-node";

/** NodeHttpServer requires the real native server factory to bind its listener. */
export const httpListener = (host: string, port: number) =>
  NodeHttpServer.layer(createServer, { host, port });
