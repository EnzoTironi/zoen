import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
} from "effect/unstable/httpapi";

import { D01Error } from "./errors.js";
import {
  CorrectionRequest,
  CorrectionSuccess,
  D01Request,
  D01Success,
} from "./operations.js";

export const D01ApiGroup = HttpApiGroup.make("d01").add(
  HttpApiEndpoint.post("execute", "/api/d01/execute", {
    error: D01Error.members,
    payload: D01Request,
    success: D01Success,
  })
);
export const CorrectionApiGroup = HttpApiGroup.make("corrections").add(
  HttpApiEndpoint.post("execute", "/api/d01/corrections", {
    error: D01Error.members,
    payload: CorrectionRequest,
    success: CorrectionSuccess,
  })
);
export const D01Api = HttpApi.make("zoen-d01").add(D01ApiGroup);
