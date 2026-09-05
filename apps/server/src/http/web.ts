import { fileURLToPath } from "node:url";

import { HttpStaticServer } from "effect/unstable/http";

/** The compiled web application shares the exact origin of identity and API. */
export const webRoutes = HttpStaticServer.layer({
  cacheControl: "no-store",
  root: fileURLToPath(new URL("../../../web/dist", import.meta.url)),
  spa: false,
});
